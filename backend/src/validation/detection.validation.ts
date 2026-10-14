import type { CandidateInput, DetectionSourceType } from '../types/detection.types.js';

const sourceTypes: DetectionSourceType[] = ['social', 'website', 'mobile_app'];
const limits = { candidateName: 200, handle: 120, description: 2000, publisher: 160, id: 160, platform: 80 };
const allowedPlatforms = new Set(['Instagram', 'Facebook', 'X', 'LinkedIn', 'YouTube', 'TikTok', 'Bluesky', 'Other', 'Google Play', 'Apple App Store', 'Android', 'iOS']);

export class CandidateValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super('Candidate validation failed.');
  }
}

function text(value: unknown, field: string, max: number, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (!required) return undefined;
    throw new CandidateValidationError([`${field} is required.`]);
  }
  if (typeof value !== 'string') throw new CandidateValidationError([`${field} must be a string.`]);
  const normalized = value.trim();
  if (required && !normalized) throw new CandidateValidationError([`${field} is required.`]);
  if (normalized.length > max) throw new CandidateValidationError([`${field} must be ${max} characters or fewer.`]);
  return normalized || undefined;
}

export function validateCandidateInput(input: unknown): CandidateInput {
  if (!input || typeof input !== 'object') throw new CandidateValidationError(['Candidate must be an object.']);
  const body = input as Record<string, unknown>;
  const sourceType = body.sourceType;
  if (!sourceTypes.includes(sourceType as DetectionSourceType)) {
    throw new CandidateValidationError(['sourceType must be social, website, or mobile_app.']);
  }
  const candidate: CandidateInput = {
    sourceType: sourceType as DetectionSourceType,
    candidateName: text(body.candidateName, 'candidateName', limits.candidateName, true)!,
    handle: text(body.handle, 'handle', limits.handle),
    url: text(body.url, 'url', 2048),
    description: text(body.description, 'description', limits.description),
    publisher: text(body.publisher, 'publisher', limits.publisher),
    packageId: text(body.packageId, 'packageId', limits.id),
    bundleId: text(body.bundleId, 'bundleId', limits.id),
    platform: text(body.platform, 'platform', limits.platform),
    observedAt: text(body.observedAt, 'observedAt', 64),
  };
  if (candidate.url) {
    try {
      const parsedUrl = new URL(candidate.url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol) || !parsedUrl.hostname) throw new Error();
    } catch {
      throw new CandidateValidationError(['url must be a valid HTTP or HTTPS URL.']);
    }
  }
  if (candidate.observedAt && Number.isNaN(Date.parse(candidate.observedAt))) throw new CandidateValidationError(['observedAt must be an ISO timestamp.']);
  if (candidate.observedAt && new Date(candidate.observedAt).getUTCFullYear() < 1970) throw new CandidateValidationError(['observedAt must be a realistic timestamp.']);
  if (candidate.platform && !allowedPlatforms.has(candidate.platform)) throw new CandidateValidationError(['platform is not supported.']);
  if (candidate.url) {
    const parsedUrl = new URL(candidate.url);
    if (parsedUrl.username || parsedUrl.password) throw new CandidateValidationError(['url must not contain embedded credentials.']);
    if (parsedUrl.port && !['80', '443'].includes(parsedUrl.port)) throw new CandidateValidationError(['url must use a standard HTTP or HTTPS port.']);
  }
  if (candidate.sourceType === 'social' && !candidate.handle && !candidate.url) {
    throw new CandidateValidationError(['Social candidates require a handle or URL.']);
  }
  if (candidate.sourceType === 'mobile_app' && !candidate.publisher && !candidate.packageId && !candidate.bundleId) {
    throw new CandidateValidationError(['Mobile app candidates require a publisher, packageId, or bundleId.']);
  }
  return candidate;
}
