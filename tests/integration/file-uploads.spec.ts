/**
 * Nashr (نشر) — file upload validation.
 *
 * Uploads are the classic path to stored XSS: the uploads directory is served
 * from the app's own origin, so an .html or .svg written there executes with
 * the customer's session. The defence is content SNIFFING with an allow-list,
 * never the client-supplied filename or Content-Type.
 *
 * The real `CustomFileValidationPipe` and the real `LocalStorage` provider are
 * exercised with real bytes, written to a real temporary directory.
 */
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CustomFileValidationPipe,
  getMaxSize,
} from '@gitroom/nestjs-libraries/upload/custom.upload.validation';
import { LocalStorage } from '@gitroom/nestjs-libraries/upload/local.storage';

const pipe = new CustomFileValidationPipe();

// ── real file bytes ────────────────────────────────────────────────────────
/** 1x1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
/** Smallest valid GIF. */
const GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
/** Minimal JPEG (SOI + APP0/JFIF + EOI). */
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);
const HTML = Buffer.from('<html><script>alert(document.cookie)</script></html>');
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
);
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00, 0, 0, 0, 0]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0, 0, 0, 8, 0, 0, 0]);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n');
const PHP = Buffer.from('<?php system($_GET["c"]); ?>');

function file(over: Partial<any> = {}) {
  return {
    fieldname: 'file',
    originalname: 'upload.png',
    mimetype: 'image/png',
    buffer: PNG,
    size: PNG.length,
    ...over,
  };
}

async function reject(f: any) {
  try {
    await pipe.transform(f);
    return null;
  } catch (err) {
    return err as Error;
  }
}

// ───────────────────────────────────────────────────────────────────────────
describe('accepted types', () => {
  it.each([
    ['png', PNG, 'image/png'],
    ['gif', GIF, 'image/gif'],
    ['jpeg', JPEG, 'image/jpeg'],
  ])('accepts a real %s', async (_label, buffer, mime) => {
    const result = await pipe.transform(
      file({ buffer, size: buffer.length, mimetype: 'application/octet-stream' })
    );
    // The mime is REPLACED by the sniffed one, not trusted from the client.
    expect(result.mimetype).toBe(mime);
  });
});

describe('dangerous types are rejected', () => {
  it.each([
    ['HTML', HTML],
    ['SVG (script-capable)', SVG],
    ['an ELF executable', ELF],
    ['a ZIP archive', ZIP],
    ['a PDF', PDF],
    ['a PHP script', PHP],
    ['an empty file', Buffer.alloc(0)],
    ['random bytes', Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04])],
  ])('rejects %s', async (_label, buffer) => {
    const err = await reject(file({ buffer, size: buffer.length }));
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err!.message).toMatch(/unsupported file type/i);
  });

  it('rejects HTML even when the client claims image/png with a .png name', async () => {
    const err = await reject(
      file({
        buffer: HTML,
        size: HTML.length,
        mimetype: 'image/png',
        originalname: 'totally-an-image.png',
      })
    );
    expect(err).toBeInstanceOf(BadRequestException);
  });

  it('rejects SVG specifically — it is an image format that executes script', async () => {
    const err = await reject(
      file({ buffer: SVG, size: SVG.length, mimetype: 'image/svg+xml' })
    );
    expect(err).toBeInstanceOf(BadRequestException);
  });

  it('rejects a PNG with an executable appended only if the sniffed type changes', async () => {
    // Polyglot: valid PNG header, script bytes appended. file-type sniffs PNG,
    // so this IS accepted — and that is correct, because the file is served
    // with an image content type and the trailing bytes are inert. Pinned so
    // the behaviour is a decision, not an accident.
    const polyglot = Buffer.concat([PNG, PHP]);
    const result = await pipe.transform(
      file({ buffer: polyglot, size: polyglot.length })
    );
    expect(result.mimetype).toBe('image/png');
  });

  it('rejects a missing or non-Buffer body', async () => {
    expect(await reject(file({ buffer: undefined }))).toBeInstanceOf(
      BadRequestException
    );
    expect(await reject(file({ buffer: 'not a buffer' as any }))).toBeInstanceOf(
      BadRequestException
    );
  });
});

describe('filename handling', () => {
  it('rewrites the extension to match the sniffed type', async () => {
    const result = await pipe.transform(
      file({ originalname: 'photo.exe', buffer: PNG, size: PNG.length })
    );
    expect(result.originalname).toBe('photo.png');
  });

  it('strips path separators so an upload cannot escape the directory', async () => {
    const result = await pipe.transform(
      file({ originalname: '../../etc/passwd.png', buffer: PNG, size: PNG.length })
    );
    expect(result.originalname).not.toContain('/');
    expect(result.originalname).not.toContain('\\');
    expect(result.originalname.startsWith('..')).toBe(true); // dots kept, slashes gone
    expect(path.basename(result.originalname)).toBe(result.originalname);
  });

  it('handles a Windows-style path', async () => {
    const result = await pipe.transform(
      file({
        originalname: 'C:\\Windows\\System32\\evil.png',
        buffer: PNG,
        size: PNG.length,
      })
    );
    expect(result.originalname).not.toContain('\\');
  });

  it('caps the base name length', async () => {
    const long = 'a'.repeat(500);
    const result = await pipe.transform(
      file({ originalname: `${long}.png`, buffer: PNG, size: PNG.length })
    );
    expect(result.originalname.length).toBeLessThanOrEqual(105);
  });

  it('supplies a name when none was given', async () => {
    const result = await pipe.transform(
      file({ originalname: undefined, buffer: PNG, size: PNG.length })
    );
    expect(result.originalname).toBe('upload.png');
  });
});

describe('size limits', () => {
  it('images are capped at 10 MB, video at 1 GB', () => {
    expect(getMaxSize('image/png')).toBe(10 * 1024 * 1024);
    expect(getMaxSize('image/jpeg')).toBe(10 * 1024 * 1024);
    expect(getMaxSize('video/mp4')).toBe(1024 * 1024 * 1024);
  });

  it('an unsupported mime has no size at all — it throws', () => {
    expect(() => getMaxSize('application/pdf')).toThrow(BadRequestException);
    expect(() => getMaxSize('text/html')).toThrow(BadRequestException);
  });

  it('rejects an image over the cap', async () => {
    const err = await reject(
      file({ buffer: PNG, size: 10 * 1024 * 1024 + 1 })
    );
    expect(err).toBeInstanceOf(BadRequestException);
    expect(err!.message).toMatch(/maximum allowed size/i);
  });

  it('accepts an image exactly at the cap', async () => {
    const result = await pipe.transform(
      file({ buffer: PNG, size: 10 * 1024 * 1024 })
    );
    expect(result.mimetype).toBe('image/png');
  });
});

describe('non-file parameters pass through untouched', () => {
  it('leaves a plain object alone', async () => {
    const body = { name: 'not a file' };
    expect(await pipe.transform(body)).toBe(body);
  });

  it('leaves null / undefined / strings alone', async () => {
    expect(await pipe.transform(null)).toBeNull();
    expect(await pipe.transform(undefined)).toBeUndefined();
    expect(await pipe.transform('org-id')).toBe('org-id');
  });
});

// ───────────────────────────────────────────────────────────────────────────
describe('LocalStorage sniffing (data URLs)', () => {
  let dir: string;
  let storage: LocalStorage;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nashr-uploads-'));
    storage = new LocalStorage(dir);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('writes a real PNG data URL and gives it a .png path', async () => {
    const result: any = await storage.uploadSimple(
      `data:image/png;base64,${PNG.toString('base64')}`
    );
    const written = String(result?.path ?? result);
    expect(written).toMatch(/\.png$/);

    // The bytes really landed on disk.
    const files: string[] = [];
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        entry.isDirectory() ? walk(full) : files.push(full);
      }
    };
    walk(dir);
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('.png'))).toBe(true);
  });

  it('refuses an HTML payload masquerading as a PNG data URL', async () => {
    await expect(
      storage.uploadSimple(`data:image/png;base64,${HTML.toString('base64')}`)
    ).rejects.toThrow(/unsupported file type/i);
  });

  it('refuses an SVG data URL', async () => {
    await expect(
      storage.uploadSimple(`data:image/svg+xml;base64,${SVG.toString('base64')}`)
    ).rejects.toThrow(/unsupported file type/i);
  });

  it('refuses a non-HTTPS remote URL (SSRF guard)', async () => {
    await expect(
      storage.uploadSimple('http://169.254.169.254/latest/meta-data/')
    ).rejects.toThrow(/unsafe url/i);
  });

  it('refuses a file:// URL', async () => {
    await expect(storage.uploadSimple('file:///etc/passwd')).rejects.toThrow();
  });

  it('refuses a private-network HTTPS URL (SSRF guard)', async () => {
    await expect(
      storage.uploadSimple('https://127.0.0.1/secret.png')
    ).rejects.toThrow(/unsafe url/i);
  });

  it('nothing dangerous was ever written to the uploads directory', () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        entry.isDirectory() ? walk(full) : files.push(full);
      }
    };
    walk(dir);
    for (const f of files) {
      expect(f).not.toMatch(/\.(html?|svg|php|js|exe|sh)$/i);
    }
  });
});
