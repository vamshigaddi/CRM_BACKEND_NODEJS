import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { randomUUID } from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const credentialsJson = this.configService.get<string>('gcp.credentialsJson');
    this.bucketName = this.configService.get<string>('gcp.bucketName') || "";

    if (credentialsJson) {
      try {
        const credentials = JSON.parse(credentialsJson);
        this.storage = new Storage({ credentials });
        this.logger.log('GCS Storage initialized with provided credentials.');
      } catch (error) {
        this.logger.error('Failed to parse GCP_CREDENTIALS_JSON. Make sure it is a valid JSON string.', error.stack);
      }
    } else {
      this.logger.warn('GCP_CREDENTIALS_JSON not found. GCS uploads will fail unless running on GCP Environment with ADC.');
      this.storage = new Storage();
    }
  }

  async uploadFile(file: Express.Multer.File, folder = 'uploads'): Promise<string> {
    if (!this.storage) {
      throw new Error('GCS Storage not initialized.');
    }

    const bucket = this.storage.bucket(this.bucketName);
    const fileName = `${folder}/${randomUUID()}-${file.originalname}`;
    const gcsFile = bucket.file(fileName);

     await gcsFile.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
    resumable: false,
  });

    // Option 1: Public URL (if bucket is public)
    return `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

  }
}
