/**
 * Redaction layer.
 *
 * Runs in three places, all of them *before* data leaves the process boundary:
 *   1. before prompt assembly           (`grounding.ts` → buildSystemPrompt)
 *   2. before audit persistence         (`audit.ts` → argsDigest / resultSummary)
 *   3. before an error reaches a human  (`errors.ts` → NashrAgentError)
 *
 * It is deliberately conservative: false positives cost a `[REDACTED]` marker,
 * false negatives cost a leaked credential.
 *
 * No imports from the rest of the library — redaction must never be the thing
 * that throws.
 */

export const REDACTED = '[REDACTED]';

/**
 * Object keys whose *values* are always dropped, regardless of shape.
 * Matched case-insensitively, ignoring `_`, `-` and `.` separators.
 */
const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /^(api|access|refresh|id|bearer|auth|session|csrf|xsrf)?token$/,
  /token$/,
  /^secret/,
  /secret$/,
  /^password/,
  /password$/,
  /^passwd$/,
  /^pwd$/,
  /apikey$/,
  /^apikey/,
  /^clientsecret$/,
  /^privatekey$/,
  /^authorization$/,
  /^cookie$/,
  /^setcookie$/,
  /^credentials?$/,
  /^signature$/,
  /^otp$/,
  /^pin$/,
  /^iban$/,
  /^emiratesid$/,
  /^nationalid$/,
  /^passportnumber$/,
  /^creditcard/,
  /^cardnumber$/,
  /^cvv$/,
];

const normalizeKey = (k: string) => k.replace(/[-_.\s]/g, '').toLowerCase();

export function isSensitiveKey(key: string): boolean {
  const n = normalizeKey(key);
  return SENSITIVE_KEY_PATTERNS.some((re) => re.test(n));
}

/**
 * Value patterns. Order matters: longer / more specific patterns run first so a
 * later generic rule cannot half-eat an earlier match.
 */
const VALUE_RULES: Array<{ re: RegExp; with: string }> = [
  // --- credentials -------------------------------------------------------
  // OpenAI / Anthropic / generic provider keys: sk-..., sk-proj-..., sk-ant-...
  { re: /\b(?:sk|pk|rk)-(?:proj-|ant-|live-|test-)?[A-Za-z0-9_-]{12,}\b/g, with: '[REDACTED_API_KEY]' },
  // AWS access key id + Google API key
  { re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, with: '[REDACTED_API_KEY]' },
  { re: /\bAIza[0-9A-Za-z_-]{35}\b/g, with: '[REDACTED_API_KEY]' },
  // Stripe / Slack / GitHub style prefixed tokens
  { re: /\b(?:xox[baprs]-|ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)[A-Za-z0-9_-]{10,}\b/g, with: '[REDACTED_TOKEN]' },
  // JWT (three base64url segments)
  { re: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g, with: '[REDACTED_TOKEN]' },
  // Authorization headers / inline assignments
  { re: /\b(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, with: '[REDACTED_TOKEN]' },
  {
    re: /\b((?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|secret|password|passwd|pwd|token)\s*[:=]\s*)("|')?[^\s"',;}]{6,}\2?/gi,
    with: '$1[REDACTED]',
  },
  // PEM blocks
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, with: '[REDACTED_PRIVATE_KEY]' },
  // Connection strings with inline credentials
  { re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@:]+:[^\s/@]+@[^\s]+/gi, with: '[REDACTED_CONNECTION_STRING]' },

  // --- personal data -----------------------------------------------------
  { re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, with: '[REDACTED_EMAIL]' },
  // International phone numbers, incl. +971 / +966 / 00971 forms.
  { re: /(?:\+|\b00)\d[\d\s().-]{7,16}\d/g, with: '[REDACTED_PHONE]' },
  // Gulf local mobile forms: 050 123 4567 / 05x-xxx-xxxx (9-11 digits, leading 0)
  { re: /\b0\d{1,2}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, with: '[REDACTED_PHONE]' },
  // Long digit runs (card / IBAN-like)
  { re: /\b\d{13,19}\b/g, with: '[REDACTED_NUMBER]' },
  { re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g, with: '[REDACTED_IBAN]' },
];

/** Redact credential and PII patterns inside a free-text string. */
export function redactText(input: string): string {
  if (typeof input !== 'string' || input.length === 0) return input;
  let out = input;
  for (const rule of VALUE_RULES) {
    out = out.replace(rule.re, rule.with as any);
  }
  return out;
}

/** UUIDs, cuids and long opaque ids — stripped from anything user/model facing
 *  so internal record identifiers are not handed out with error text. */
const IDENTIFIER_RULES: RegExp[] = [
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
  /\bc[a-z0-9]{24,}\b/gi,
];

export function redactIdentifiers(input: string): string {
  if (typeof input !== 'string') return input;
  return IDENTIFIER_RULES.reduce((acc, re) => acc.replace(re, '[id]'), input);
}

export interface RedactOptions {
  /** Maximum characters kept per string value. Default 512. */
  maxStringLength?: number;
  /** Maximum array items kept. Default 25. */
  maxArrayLength?: number;
  /** Maximum object depth. Default 6. */
  maxDepth?: number;
}

/**
 * Deep-redact an arbitrary value. Sensitive keys are dropped entirely;
 * remaining strings go through `redactText`. Cycles are broken. The result is
 * always JSON-serialisable.
 */
export function redactDeep(value: unknown, options: RedactOptions = {}): unknown {
  const maxStringLength = options.maxStringLength ?? 512;
  const maxArrayLength = options.maxArrayLength ?? 25;
  const maxDepth = options.maxDepth ?? 6;
  const seen = new WeakSet<object>();

  const walk = (val: unknown, depth: number): unknown => {
    if (val === null || val === undefined) return val ?? null;

    const t = typeof val;
    if (t === 'string') {
      const s = redactText(val as string);
      return s.length > maxStringLength ? `${s.slice(0, maxStringLength)}…[truncated]` : s;
    }
    if (t === 'number' || t === 'boolean') return val;
    if (t === 'bigint') return String(val);
    if (t === 'function' || t === 'symbol') return REDACTED;

    if (val instanceof Date) return val.toISOString();
    if (val instanceof Error) return redactText(`${val.name}: ${val.message}`);

    if (depth >= maxDepth) return '[depth-limit]';

    if (Array.isArray(val)) {
      if (seen.has(val)) return '[circular]';
      seen.add(val);
      const kept = val.slice(0, maxArrayLength).map((v) => walk(v, depth + 1));
      if (val.length > maxArrayLength) kept.push(`…${val.length - maxArrayLength} more`);
      return kept;
    }

    if (t === 'object') {
      if (seen.has(val as object)) return '[circular]';
      seen.add(val as object);
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = isSensitiveKey(k) ? REDACTED : walk(v, depth + 1);
      }
      return out;
    }

    return REDACTED;
  };

  return walk(value, 0);
}

/**
 * Build the string persisted to `NashrAgentActionLog.argsDigest`.
 * Contains a stable non-reversible fingerprint plus the redacted shape, so an
 * auditor can tell *what kind of* call happened without recovering the payload.
 */
export function buildArgsDigest(
  args: unknown,
  hash: (input: string) => string,
  maxLength = 2000
): string {
  let raw: string;
  try {
    raw = JSON.stringify(args ?? null);
  } catch {
    raw = '[unserialisable]';
  }
  const fingerprint = hash(raw).slice(0, 32);
  let redacted: string;
  try {
    redacted = JSON.stringify(redactDeep(args));
  } catch {
    redacted = '"[unserialisable]"';
  }
  const body = `{"fp":"${fingerprint}","args":${redacted}}`;
  return body.length > maxLength ? `${body.slice(0, maxLength - 1)}}` : body;
}

/** Summarise a tool result for the audit log without storing the payload. */
export function buildResultSummary(result: unknown, maxLength = 1000): string {
  let s: string;
  try {
    s = JSON.stringify(redactDeep(result, { maxStringLength: 160, maxArrayLength: 10 }));
  } catch {
    s = '"[unserialisable]"';
  }
  return s.length > maxLength ? `${s.slice(0, maxLength)}…` : s;
}
