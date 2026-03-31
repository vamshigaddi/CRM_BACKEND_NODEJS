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
    this.bucketName = this.configService.get<string>('gcp.bucketName') || "";

    this.storage = new Storage(); // Use default ADC (Application Default Credentials)
    this.logger.log('GCS Storage initialized using Application Default Credentials.');
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
