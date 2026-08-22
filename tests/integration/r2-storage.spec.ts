import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { CloudflareStorage } from '@gitroom/nestjs-libraries/upload/cloudflare.storage';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

const file = (): Express.Multer.File =>
  ({
    fieldname: 'file',
    originalname: 'pixel.png',
    encoding: '7bit',
    mimetype: 'image/png',
    size: PNG.length,
    buffer: PNG,
  }) as Express.Multer.File;

describe('Cloudflare R2 storage boundary', () => {
  let send: jest.SpyInstance;
  let storage: CloudflareStorage;

  beforeEach(() => {
    send = jest.spyOn(S3Client.prototype, 'send').mockResolvedValue({});
    storage = new CloudflareStorage(
      'account-id',
      'access-key',
      'secret-key',
      'auto',
      'nashr-media',
      'https://media.example.com/'
    );
  });

  afterEach(() => {
    send.mockRestore();
  });

  it('uploads without an unsupported S3 object ACL and returns one-slash URLs', async () => {
    const uploaded = await storage.uploadFile(file());
    const command = send.mock.calls[0][0] as PutObjectCommand;

    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe('nashr-media');
    expect(command.input.ContentType).toBe('image/png');
    expect(command.input).not.toHaveProperty('ACL');
    expect(uploaded.path).toMatch(/^https:\/\/media\.example\.com\/[\w-]+\.png$/);
  });

  it('deletes an object belonging to the configured media origin', async () => {
    await storage.removeFile('https://media.example.com/folder/asset.png');
    const command = send.mock.calls[0][0] as DeleteObjectCommand;

    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'nashr-media',
      Key: 'folder/asset.png',
    });
  });

  it('refuses to delete a URL outside the configured media origin', async () => {
    await expect(
      storage.removeFile('https://attacker.example/asset.png')
    ).rejects.toThrow(/configured R2 media origin/i);
    expect(send).not.toHaveBeenCalled();
  });

  it('rejects the rate-limited r2.dev endpoint in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(
        () =>
          new CloudflareStorage(
            'account-id',
            'access-key',
            'secret-key',
            'auto',
            'nashr-media',
            'https://pub-example.r2.dev'
          )
      ).toThrow(/custom domain/i);
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });
});
