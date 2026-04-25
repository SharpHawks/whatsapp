import { v4 as uuidv4 } from 'uuid';
import { db } from '../database';
import { MediaFile } from '../types';
import { ValidationError, NotFoundError, ErrorCode } from '../utils/errors';
import { logger } from '../utils/logger';

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16 MB

const ALLOWED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/3gpp', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/mp4', 'audio/amr'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

export class MediaService {
  async uploadMedia(
    botId: string,
    file: Buffer,
    filename: string,
    mimeType: string
  ): Promise<MediaFile> {
    // Validate file size
    if (file.length > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024} MB`
      );
    }

    // Validate mime type
    if (!this.isValidMimeType(mimeType)) {
      throw new ValidationError(
        `Unsupported file type: ${mimeType}. Supported types: images, videos, audio, documents`
      );
    }

    const mediaId = uuidv4();

    // In production, upload to S3 or similar cloud storage
    // For now, we'll store the URL as a placeholder
    const storageUrl = await this.uploadToStorage(mediaId, file, mimeType);

    // Store metadata in database
    const result = await db.query<MediaFile>(
      `INSERT INTO media_files (id, bot_id, filename, mime_type, size_bytes, storage_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, bot_id as "botId", filename, mime_type as "mimeType", 
                 size_bytes as "sizeBytes", storage_url as "storageUrl", created_at as "createdAt"`,
      [mediaId, botId, filename, mimeType, file.length, storageUrl]
    );

    logger.info(`Media uploaded: ${mediaId} for bot ${botId}`);
    return result.rows[0];
  }

  async getMedia(mediaId: string, botId: string): Promise<MediaFile> {
    const result = await db.query<MediaFile>(
      `SELECT id, bot_id as "botId", filename, mime_type as "mimeType", 
              size_bytes as "sizeBytes", storage_url as "storageUrl", created_at as "createdAt"
       FROM media_files
       WHERE id = $1 AND bot_id = $2`,
      [mediaId, botId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(ErrorCode.MEDIA_NOT_FOUND, 'Media file not found');
    }

    return result.rows[0];
  }

  async deleteMedia(mediaId: string, botId: string): Promise<void> {
    const media = await this.getMedia(mediaId, botId);

    // Delete from storage
    await this.deleteFromStorage(media.storageUrl);

    // Delete from database
    await db.query('DELETE FROM media_files WHERE id = $1', [mediaId]);

    logger.info(`Media deleted: ${mediaId}`);
  }

  private isValidMimeType(mimeType: string): boolean {
    const allAllowedTypes = Object.values(ALLOWED_MIME_TYPES).flat();
    return allAllowedTypes.includes(mimeType);
  }

  private async uploadToStorage(mediaId: string, _file: Buffer, _mimeType: string): Promise<string> {
    // TODO: Implement actual S3 upload
    // For now, return a placeholder URL
    // In production, use AWS SDK:
    // const s3 = new AWS.S3();
    // const params = {
    //   Bucket: config.aws.s3Bucket,
    //   Key: `media/${mediaId}`,
    //   Body: file,
    //   ContentType: mimeType,
    // };
    // const result = await s3.upload(params).promise();
    // return result.Location;

    return `https://storage.example.com/media/${mediaId}`;
  }

  private async deleteFromStorage(storageUrl: string): Promise<void> {
    // TODO: Implement actual S3 deletion
    // const s3 = new AWS.S3();
    // const key = storageUrl.split('/').pop();
    // await s3.deleteObject({ Bucket: config.aws.s3Bucket, Key: `media/${key}` }).promise();
    
    logger.debug(`Would delete from storage: ${storageUrl}`);
  }
}

export const mediaService = new MediaService();
