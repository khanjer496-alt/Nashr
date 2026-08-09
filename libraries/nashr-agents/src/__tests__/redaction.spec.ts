import {
  buildArgsDigest,
  buildResultSummary,
  isSensitiveKey,
  redactDeep,
  redactIdentifiers,
  redactText,
} from '../redaction';
import { sha256 } from '../audit';

describe('redaction — credentials', () => {
  it.each([
    ['sk-proj-AbCdEf1234567890XyZ', 'OpenAI project key'],
    ['sk-ant-api03-aaaaaaaaaaaaaaaaaaaa', 'Anthropic key'],
    ['AKIAIOSFODNN7EXAMPLE', 'AWS access key id'],
    ['AIzaSyD-1234567890abcdefghijklmnopqrstu', 'Google API key'],
    ['xoxb-123456789012-abcdefghijklmno', 'Slack bot token'],
    ['ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345', 'GitHub PAT'],
  ])('strips %s (%s)', (secret) => {
    const output = redactText(`the key is ${secret} ok`);
    expect(output).not.toContain(secret);
    expect(output).toMatch(/\[REDACTED_(API_KEY|TOKEN)\]/);
  });

  it('strips a JWT', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(redactText(jwt)).toBe('[REDACTED_TOKEN]');
  });

  it('strips Authorization headers', () => {
    expect(redactText('Authorization: Bearer abc123def456ghi789')).not.toContain('abc123def456');
  });

  it('strips inline assignments', () => {
    const out = redactText('api_key=super-secret-value-1 password: hunter22222');
    expect(out).not.toContain('super-secret-value-1');
    expect(out).not.toContain('hunter22222');
  });

  it('strips a connection string with inline credentials', () => {
    const out = redactText('postgresql://admin:p4ssw0rd@db.internal:5432/nashr');
    expect(out).toBe('[REDACTED_CONNECTION_STRING]');
  });

  it('strips a private key block', () => {
    const pem =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';
    expect(redactText(pem)).toBe('[REDACTED_PRIVATE_KEY]');
  });
});

describe('redaction — personal data', () => {
  it('strips email addresses', () => {
    expect(redactText('write to layla.hassan@example.ae please')).toBe(
      'write to [REDACTED_EMAIL] please'
    );
  });

  it.each([
    '+971 50 123 4567',
    '+966501234567',
    '00971501234567',
    '050 123 4567',
    '055-123-4567',
  ])('strips the MENA phone number %s', (phone) => {
    const out = redactText(`call ${phone} now`);
    expect(out).toContain('[REDACTED_PHONE]');
    expect(out).not.toContain('1234567');
  });

  it('strips card-length digit runs', () => {
    expect(redactText('card 4111111111111111 x')).toBe('card [REDACTED_NUMBER] x');
  });

  it('leaves ordinary marketing copy alone', () => {
    const copy = 'Fresh manakish every morning from 7am. 20% off this week only!';
    expect(redactText(copy)).toBe(copy);
  });

  it('leaves Arabic copy alone', () => {
    const copy = 'أشهى المناقيش الطازجة كل صباح — خصم ٢٠٪ هذا الأسبوع';
    expect(redactText(copy)).toBe(copy);
  });

  it('leaves analytics-sized numbers alone', () => {
    expect(redactText('impressions: 128430')).toBe('impressions: 128430');
  });
});

describe('redaction — object keys', () => {
  it.each([
    'token',
    'accessToken',
    'refresh_token',
    'apiKey',
    'API_KEY',
    'clientSecret',
    'password',
    'authorization',
    'cookie',
    'credentials',
    'emiratesId',
    'iban',
  ])('treats "%s" as sensitive', (key) => {
    expect(isSensitiveKey(key)).toBe(true);
  });

  it.each(['brandName', 'industry', 'toneOfVoice', 'market', 'total'])(
    'does not treat "%s" as sensitive',
    (key) => {
      expect(isSensitiveKey(key)).toBe(false);
    }
  );

  it('drops sensitive values at any depth', () => {
    const out = redactDeep({
      brandName: 'Zaytoun',
      integration: {
        name: 'instagram',
        token: 'sk-proj-shouldneverappear',
        nested: { refreshToken: 'abcd', contact: 'owner@zaytoun.ae' },
      },
    }) as any;

    expect(out.brandName).toBe('Zaytoun');
    expect(out.integration.token).toBe('[REDACTED]');
    expect(out.integration.nested.refreshToken).toBe('[REDACTED]');
    expect(out.integration.nested.contact).toBe('[REDACTED_EMAIL]');
    expect(JSON.stringify(out)).not.toContain('shouldneverappear');
  });

  it('survives circular structures', () => {
    const a: any = { name: 'a' };
    a.self = a;
    expect(() => redactDeep(a)).not.toThrow();
    expect(JSON.stringify(redactDeep(a))).toContain('circular');
  });

  it('redacts identifiers for user-facing text', () => {
    expect(
      redactIdentifiers('failed for 3f2504e0-4f89-11d3-9a0c-0305e82c3301')
    ).toBe('failed for [id]');
  });
});

describe('audit digests', () => {
  it('fingerprints without storing the payload', () => {
    const digest = buildArgsDigest(
      { email: 'owner@clinic.ae', token: 'sk-proj-topsecretvalue1' },
      sha256
    );
    expect(digest).not.toContain('owner@clinic.ae');
    expect(digest).not.toContain('topsecretvalue1');
    expect(digest).toContain('"fp":"');
    expect(JSON.parse(digest).args.token).toBe('[REDACTED]');
  });

  it('produces the same fingerprint for the same payload', () => {
    const a = buildArgsDigest({ x: 1 }, sha256);
    const b = buildArgsDigest({ x: 1 }, sha256);
    expect(JSON.parse(a).fp).toBe(JSON.parse(b).fp);
  });

  it('summarises results without leaking secrets', () => {
    const summary = buildResultSummary({ ok: true, accessToken: 'abc', note: 'ping me at a@b.co' });
    expect(summary).not.toContain('"abc"');
    expect(summary).toContain('REDACTED');
  });
});
