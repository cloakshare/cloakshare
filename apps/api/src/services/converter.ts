import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { nanoid } from 'nanoid';
import pLimit from 'p-limit';
import { logger } from '../lib/logger.js';
import { OFFICE_FILE_EXTENSIONS } from '@cloak/shared';

const execFileAsync = promisify(execFile);

const LIBREOFFICE_BIN = process.env.LIBREOFFICE_PATH || '/usr/bin/soffice';
const CONVERSION_TIMEOUT = 120_000; // 2 minutes max
const MAX_OFFICE_FILE_SIZE = 50 * 1024 * 1024; // 50MB for Office docs

// Separate concurrency limiter — LibreOffice is CPU/memory heavy (~200MB RSS per instance)
const convertLimit = pLimit(2);

/**
 * Check if a file extension is an office document that needs conversion.
 */
export function isOfficeDocument(ext: string): boolean {
  return (OFFICE_FILE_EXTENSIONS as readonly string[]).includes(ext.toLowerCase());
}

/**
 * Convert an office document to PDF using LibreOffice headless.
 * Returns the PDF buffer, or the original buffer if already PDF.
 */
export async function convertToPdf(
  inputBuffer: Buffer,
  originalFilename: string,
): Promise<Buffer> {
  if (inputBuffer.length > MAX_OFFICE_FILE_SIZE) {
    throw new Error(
      `Office document too large: ${(inputBuffer.length / 1024 / 1024).toFixed(1)}MB (max ${MAX_OFFICE_FILE_SIZE / 1024 / 1024}MB)`,
    );
  }

  return convertLimit(() => doConversion(inputBuffer, originalFilename));
}

async function doConversion(inputBuffer: Buffer, originalFilename: string): Promise<Buffer> {
  const jobId = nanoid(10);
  const tmpDir = `/tmp/cloak-convert-${jobId}`;
  await mkdir(tmpDir, { recursive: true });

  const ext = extname(originalFilename) || '.docx';
  const inputPath = join(tmpDir, `input${ext}`);
  await writeFile(inputPath, inputBuffer);

  try {
    // LibreOffice headless conversion.
    // --env:UserInstallation gives each job its own user profile to prevent
    // lock file conflicts and zero-byte output on concurrent conversions.
    await execFileAsync(LIBREOFFICE_BIN, [
      '--headless',
      '--invisible',
      '--norestore',
      '--nolockcheck',
      `--env:UserInstallation=file://${tmpDir}/profile`,
      '--convert-to', 'pdf',
      '--outdir', tmpDir,
      inputPath,
    ], {
      timeout: CONVERSION_TIMEOUT,
      env: {
        ...process.env,
        HOME: tmpDir,
        SAL_USE_VCLPLUGIN: 'svp', // Server virtual plugin — no display needed
      },
      killSignal: 'SIGKILL',
    });

    const pdfPath = join(tmpDir, 'input.pdf');
    if (!existsSync(pdfPath)) {
      throw new Error(`LibreOffice conversion produced no output for ${originalFilename}`);
    }

    const pdfBuffer = await readFile(pdfPath);

    if (pdfBuffer.length === 0) {
      throw new Error(
        `LibreOffice conversion produced empty PDF for ${originalFilename}. ` +
        'This usually means the input file is corrupted or password-protected.',
      );
    }

    logger.info({ jobId, originalFilename, pdfSize: pdfBuffer.length }, 'Office document converted to PDF');
    return pdfBuffer;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
