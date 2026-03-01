import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { mkdir, writeFile, readFile, unlink, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { config } from '../lib/config.js';
import { logger } from '../lib/logger.js';

// Storage abstraction interface
export interface StorageProvider {
  upload(key: string, data: Buffer, contentType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string>;
}

// ============================================
// LOCAL STORAGE (self-hosted mode)
// ============================================

class LocalStorage implements StorageProvider {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private getFilePath(key: string): string {
    return join(this.basePath, key);
  }

  async upload(key: string, data: Buffer, _contentType: string): Promise<string> {
    const filePath = this.getFilePath(key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = this.getFilePath(key);
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    if (existsSync(filePath)) {
      await unlink(filePath);
    }
  }

  async deletePrefix(prefix: string): Promise<void> {
    const dirPath = this.getFilePath(prefix);
    if (existsSync(dirPath)) {
      await rm(dirPath, { recursive: true, force: true });
    }
  }

  async exists(key: string): Promise<boolean> {
    return existsSync(this.getFilePath(key));
  }

  async getSignedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    // Local mode: return an internal API route that serves the file
    return `${config.apiUrl}/internal/files/${key}`;
  }

  async getPresignedUploadUrl(key: string, _contentType: string, _expiresInSeconds: number): Promise<string> {
    // Local mode: uploads go through the API directly
    return `${config.apiUrl}/internal/upload/${key}`;
  }
}

// ============================================
// S3 STORAGE (cloud mode — works with R2, MinIO, AWS S3, Backblaze B2)
// ============================================

class S3Storage implements StorageProvider {
  private client: S3Client;
  private bucketName: string;

  constructor(cfg: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    forcePathStyle?: boolean;
  }) {
    this.bucketName = cfg.bucketName;
    this.client = new S3Client({
      endpoint: cfg.endpoint,
      region: cfg.region,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
      forcePathStyle: cfg.forcePathStyle ?? false,
    });
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<string> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: data,
      ContentType: contentType,
    }));
    return key;
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }));
    const chunks: Uint8Array[] = [];
    // @ts-expect-error - Body is a readable stream
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    }));
  }

  async deletePrefix(prefix: string): Promise<void> {
    const response = await this.client.send(new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix,
    }));

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key) {
          await this.delete(obj.Key);
        }
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async getPresignedUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

// ============================================
// FACTORY
// ============================================

let storageInstance: StorageProvider | null = null;

export function createStorage(): StorageProvider {
  if (storageInstance) return storageInstance;

  if (config.storage.provider === 's3') {
    if (!config.storage.s3AccessKeyId || !config.storage.s3SecretAccessKey) {
      throw new Error('S3 storage requires S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY');
    }
    logger.info({ endpoint: config.storage.s3Endpoint, bucket: config.storage.s3BucketName }, 'Using S3-compatible storage');
    storageInstance = new S3Storage({
      endpoint: config.storage.s3Endpoint,
      region: config.storage.s3Region,
      accessKeyId: config.storage.s3AccessKeyId,
      secretAccessKey: config.storage.s3SecretAccessKey,
      bucketName: config.storage.s3BucketName,
      forcePathStyle: config.storage.s3ForcePathStyle,
    });
  } else {
    logger.info({ path: config.storage.localPath }, 'Using local file storage');
    storageInstance = new LocalStorage(config.storage.localPath);
  }

  return storageInstance;
}

// Convenience export
export const storage = {
  get instance(): StorageProvider {
    return createStorage();
  },
};
