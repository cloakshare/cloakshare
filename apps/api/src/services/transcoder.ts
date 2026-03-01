import { execFile as execFileCb, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { writeFile, readFile, readdir, mkdir, rm } from 'node:fs/promises';
import { nanoid } from 'nanoid';
import pLimit from 'p-limit';
import sharp from 'sharp';
import { createStorage } from './storage.js';
import { logger } from '../lib/logger.js';
import {
  MAX_CONCURRENT_TRANSCODES,
  VIDEO_SEGMENT_DURATION,
  VIDEO_TRANSCODE_PROFILES,
  VIDEO_SIGNED_URL_EXPIRY,
  THUMBNAIL_WIDTH,
  THUMBNAIL_WEBP_QUALITY,
} from '@cloak/shared';
import type { VideoQuality } from '@cloak/shared';

const execFile = promisify(execFileCb);

const FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';
const TRANSCODE_TIMEOUT = 600_000; // 10 minutes

export const transcodeLimit = pLimit(MAX_CONCURRENT_TRANSCODES);
const uploadLimit = pLimit(5); // concurrent segment uploads to storage

export interface TranscodeResult {
  duration: number;
  width: number;
  height: number;
  qualities: string[];
  codec: string;
  thumbnailKey: string;
}

export type TranscodeProgressCallback = (progress: {
  percent: number;
  message: string;
}) => void;

interface ProbeResult {
  duration: number;
  width: number;
  height: number;
  codec: string;
}

/**
 * Probe a video file for metadata using ffprobe.
 */
async function probeVideo(filePath: string): Promise<ProbeResult> {
  const { stdout } = await execFile(FFPROBE_BIN, [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  const data = JSON.parse(stdout);
  const videoStream = data.streams?.find((s: any) => s.codec_type === 'video');

  if (!videoStream) {
    throw new Error('No video stream found — audio-only files are not supported');
  }

  return {
    duration: parseFloat(data.format?.duration || videoStream.duration || '0'),
    width: videoStream.width || 0,
    height: videoStream.height || 0,
    codec: videoStream.codec_name || 'unknown',
  };
}

/**
 * Determine which quality levels to transcode based on the original resolution.
 */
function determineQualities(width: number, height: number): string[] {
  const profiles = VIDEO_TRANSCODE_PROFILES;

  // If original is smaller than 720p, transcode at original resolution only
  if (width < profiles['720p'].width && height < profiles['720p'].height) {
    return ['original'];
  }
  // If original is smaller than 1080p, only do 720p
  if (width < profiles['1080p'].width && height < profiles['1080p'].height) {
    return ['720p'];
  }
  return ['720p', '1080p'];
}

/**
 * Get the scale filter and bitrate for a quality level.
 */
function getProfileArgs(quality: string, originalWidth: number, originalHeight: number): {
  scaleFilter: string;
  videoBitrate: string;
  audioBitrate: string;
  width: number;
  height: number;
} {
  if (quality === 'original') {
    // Use original dimensions, scale bitrate proportionally
    const pixels = originalWidth * originalHeight;
    const bitrate = Math.min(Math.round(pixels / 400), 5000); // ~proportional
    return {
      scaleFilter: `scale=${originalWidth}:${originalHeight}`,
      videoBitrate: `${bitrate}k`,
      audioBitrate: '128k',
      width: originalWidth,
      height: originalHeight,
    };
  }

  const profile = VIDEO_TRANSCODE_PROFILES[quality as VideoQuality];
  return {
    scaleFilter: `scale=${profile.width}:${profile.height}:force_original_aspect_ratio=decrease,pad=${profile.width}:${profile.height}:(ow-iw)/2:(oh-ih)/2`,
    videoBitrate: profile.videoBitrate,
    audioBitrate: profile.audioBitrate,
    width: profile.width,
    height: profile.height,
  };
}

/**
 * Transcode a video to HLS for a single quality level.
 * Returns the number of segments produced.
 */
function transcodeQuality(
  inputPath: string,
  outputDir: string,
  quality: string,
  originalWidth: number,
  originalHeight: number,
  totalDuration: number,
  onProgress?: (percent: number) => void,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const profile = getProfileArgs(quality, originalWidth, originalHeight);
    const playlistPath = join(outputDir, 'playlist.m3u8');
    const segmentPattern = join(outputDir, 'segment-%03d.ts');

    const args = [
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-b:v', profile.videoBitrate,
      '-c:a', 'aac',
      '-b:a', profile.audioBitrate,
      '-vf', profile.scaleFilter,
      '-f', 'hls',
      '-hls_time', String(VIDEO_SEGMENT_DURATION),
      '-hls_list_size', '0',
      '-hls_flags', 'independent_segments',
      '-hls_segment_filename', segmentPattern,
      '-progress', 'pipe:1', // Write progress to stdout
      '-y', // Overwrite
      playlistPath,
    ];

    const proc = spawn(FFMPEG_BIN, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: TRANSCODE_TIMEOUT,
    });

    let stderrData = '';

    // Parse progress from stdout (pipe:1 format: key=value lines)
    proc.stdout?.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n');
      for (const line of lines) {
        if (line.startsWith('out_time_us=')) {
          const microseconds = parseInt(line.split('=')[1], 10);
          if (!isNaN(microseconds) && totalDuration > 0) {
            const seconds = microseconds / 1_000_000;
            const pct = Math.min(Math.round((seconds / totalDuration) * 100), 99);
            onProgress?.(pct);
          }
        }
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrData += chunk.toString();
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        const errMsg = stderrData.slice(-500);
        reject(new Error(`FFmpeg exited with code ${code}: ${errMsg}`));
        return;
      }

      try {
        const files = await readdir(outputDir);
        const segmentCount = files.filter(f => f.endsWith('.ts')).length;
        resolve(segmentCount);
      } catch (err) {
        reject(err);
      }
    });

    proc.on('error', reject);
  });
}

/**
 * Generate a master HLS playlist referencing all quality variants.
 */
function generateMasterPlaylist(qualities: string[], originalWidth: number, originalHeight: number): string {
  let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n';

  for (const quality of qualities) {
    const profile = getProfileArgs(quality, originalWidth, originalHeight);
    const bandwidthVideo = parseInt(profile.videoBitrate) * 1000;
    const bandwidthAudio = parseInt(profile.audioBitrate) * 1000;
    const bandwidth = bandwidthVideo + bandwidthAudio;

    manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${profile.width}x${profile.height}\n`;
    manifest += `${quality}/playlist.m3u8\n`;
  }

  return manifest;
}

/**
 * Generate a per-session master playlist with pre-signed segment URLs baked in.
 * Used for Safari/iOS which has native HLS and can't use HLS.js xhrSetup.
 */
export async function generateSessionManifest(
  linkId: string,
  qualities: string[],
): Promise<string> {
  const storage = createStorage();
  let masterManifest = '#EXTM3U\n#EXT-X-VERSION:3\n';

  for (const quality of qualities) {
    const profile = getProfileArgs(quality, 0, 0); // only need width/height for stream-inf
    const bandwidthVideo = parseInt(profile.videoBitrate) * 1000 || 2500000;
    const bandwidthAudio = parseInt(profile.audioBitrate) * 1000 || 128000;

    // Read the variant playlist from storage
    const variantKey = `renders/${linkId}/video/${quality}/playlist.m3u8`;
    const variantBuffer = await storage.download(variantKey);
    const variantContent = variantBuffer.toString('utf-8');

    // Replace segment filenames with signed URLs
    const signedVariant = await rewritePlaylistWithSignedUrls(
      variantContent, linkId, quality,
    );

    // Inline the variant as a data URI is not possible with HLS, so we need to
    // create a signed URL for the rewritten playlist itself.
    // Instead, we'll return a combined response with inline playlists.
    masterManifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidthVideo + bandwidthAudio},RESOLUTION=${profile.width || 1280}x${profile.height || 720}\n`;
    masterManifest += `data:application/vnd.apple.mpegurl;base64,${Buffer.from(signedVariant).toString('base64')}\n`;
  }

  return masterManifest;
}

/**
 * Rewrite a variant playlist, replacing relative segment paths with signed URLs.
 */
async function rewritePlaylistWithSignedUrls(
  playlistContent: string,
  linkId: string,
  quality: string,
): Promise<string> {
  const storage = createStorage();
  const lines = playlistContent.split('\n');
  const result: string[] = [];

  for (const line of lines) {
    if (line.endsWith('.ts')) {
      const segmentKey = `renders/${linkId}/video/${quality}/${line.trim()}`;
      const signedUrl = await storage.getSignedUrl(segmentKey, VIDEO_SIGNED_URL_EXPIRY);
      result.push(signedUrl);
    } else {
      result.push(line);
    }
  }

  return result.join('\n');
}

/**
 * Extract a thumbnail frame from a video at the given timestamp.
 */
async function extractThumbnail(
  inputPath: string,
  linkId: string,
  timestampSec: number = 2,
): Promise<string> {
  const workDir = join(tmpdir(), `cloak-thumb-${nanoid(8)}`);
  await mkdir(workDir, { recursive: true });
  const thumbJpgPath = join(workDir, 'thumb.jpg');

  try {
    await execFile(FFMPEG_BIN, [
      '-ss', String(timestampSec),
      '-i', inputPath,
      '-frames:v', '1',
      '-q:v', '2',
      '-y',
      thumbJpgPath,
    ], { timeout: 30_000 });
  } catch {
    // If seeking to timestampSec fails (video too short), try from start
    if (timestampSec > 0) {
      await execFile(FFMPEG_BIN, [
        '-ss', '0',
        '-i', inputPath,
        '-frames:v', '1',
        '-q:v', '2',
        '-y',
        thumbJpgPath,
      ], { timeout: 30_000 });
    }
  }

  const jpgBuffer = await readFile(thumbJpgPath);
  const webpBuffer = await sharp(jpgBuffer)
    .resize(THUMBNAIL_WIDTH)
    .webp({ quality: THUMBNAIL_WEBP_QUALITY })
    .toBuffer();

  const storage = createStorage();
  const thumbnailKey = `renders/${linkId}/thumb.webp`;
  await storage.upload(thumbnailKey, webpBuffer, 'image/webp');

  await rm(workDir, { recursive: true, force: true }).catch(() => {});

  return thumbnailKey;
}

/**
 * Main entry point: transcode a video to HLS with adaptive bitrate.
 *
 * Pipeline: write to temp → probe → determine qualities → transcode per quality →
 * upload segments → generate master playlist → extract thumbnail → cleanup
 */
export async function transcodeVideo(
  fileBuffer: Buffer,
  linkId: string,
  originalFilename: string,
  onProgress?: TranscodeProgressCallback,
): Promise<TranscodeResult> {
  return transcodeLimit(async () => {
    const workDir = join(tmpdir(), `cloak-transcode-${nanoid()}`);
    await mkdir(workDir, { recursive: true });

    const ext = extname(originalFilename) || '.mp4';
    const inputPath = join(workDir, `input${ext}`);
    await writeFile(inputPath, fileBuffer);

    const storage = createStorage();

    try {
      // Step 1: Probe video metadata
      onProgress?.({ percent: 0, message: 'Analyzing video...' });
      const probe = await probeVideo(inputPath);
      logger.info({ linkId, probe }, 'Video probed');

      if (probe.duration <= 0) {
        throw new Error('Could not determine video duration');
      }

      // Step 2: Determine quality levels
      const qualities = determineQualities(probe.width, probe.height);
      const totalQualities = qualities.length;

      // Step 3: Transcode each quality level
      for (let qi = 0; qi < qualities.length; qi++) {
        const quality = qualities[qi];
        const qualityDir = join(workDir, 'output', quality);
        await mkdir(qualityDir, { recursive: true });

        const basePercent = Math.round((qi / totalQualities) * 80); // 0-80% for transcoding

        onProgress?.({
          percent: basePercent,
          message: `Transcoding ${quality === 'original' ? `${probe.width}x${probe.height}` : quality}...`,
        });

        await transcodeQuality(
          inputPath,
          qualityDir,
          quality,
          probe.width,
          probe.height,
          probe.duration,
          (pct) => {
            const scaledPct = basePercent + Math.round((pct / 100) * (80 / totalQualities));
            onProgress?.({
              percent: Math.min(scaledPct, 89),
              message: `Transcoding ${quality === 'original' ? `${probe.width}x${probe.height}` : quality}... ${pct}%`,
            });
          },
        );

        // Upload segments and playlist for this quality
        onProgress?.({
          percent: basePercent + Math.round(80 / totalQualities) - 2,
          message: `Uploading ${quality} segments...`,
        });

        const files = await readdir(qualityDir);
        const segments = files.filter(f => f.endsWith('.ts'));
        const playlist = files.find(f => f.endsWith('.m3u8'));

        // Upload segments concurrently (pLimit(5))
        await Promise.all(segments.map(seg =>
          uploadLimit(async () => {
            const segBuffer = await readFile(join(qualityDir, seg));
            const segKey = `renders/${linkId}/video/${quality}/${seg}`;
            await storage.upload(segKey, segBuffer, 'video/mp2t');
          })
        ));

        // Upload variant playlist
        if (playlist) {
          const playlistBuffer = await readFile(join(qualityDir, playlist));
          const playlistKey = `renders/${linkId}/video/${quality}/playlist.m3u8`;
          await storage.upload(playlistKey, playlistBuffer, 'application/vnd.apple.mpegurl');
        }
      }

      // Step 4: Generate and upload master playlist
      onProgress?.({ percent: 90, message: 'Generating master playlist...' });
      const masterPlaylist = generateMasterPlaylist(qualities, probe.width, probe.height);
      const masterKey = `renders/${linkId}/video/master.m3u8`;
      await storage.upload(masterKey, Buffer.from(masterPlaylist), 'application/vnd.apple.mpegurl');

      // Step 5: Extract thumbnail
      onProgress?.({ percent: 95, message: 'Extracting thumbnail...' });
      const thumbnailKey = await extractThumbnail(inputPath, linkId);

      logger.info({ linkId, qualities, duration: probe.duration }, 'Video transcoding complete');

      return {
        duration: probe.duration,
        width: probe.width,
        height: probe.height,
        qualities,
        codec: probe.codec,
        thumbnailKey,
      };
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  });
}
