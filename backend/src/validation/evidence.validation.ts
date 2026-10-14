import { createHash } from 'node:crypto';
import type { CandidateInput } from '../types/detection.types.js';
import type { EvidenceCandidate, EvidenceRecord, EvidenceType } from '../types/evidence.types.js';
import { normalizeComparable, normalizeHostname } from '../detection/normalize.js';

export function evidenceTypeFor(sourceType: CandidateInput['sourceType']): EvidenceType {
  if (sourceType === 'social') return 'social_profile';
  if (sourceType === 'mobile_app') return 'mobile_app';
  return 'website';
}

function normalizedUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const parsed = new URL(url);
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  parsed.hostname = parsed.hostname.toLowerCase();
  parsed.pathname = parsed.pathname.replace(/\/+$/, '') || '/';
  return parsed.toString();
}

export function normalizeEvidenceCandidate(candidate: CandidateInput): EvidenceCandidate {
  return {
    brandId: '',
    sourceType: candidate.sourceType,
    candidateName: normalizeComparable(candidate.candidateName),
    handle: candidate.handle ? normalizeComparable(candidate.handle) : undefined,
    url: normalizedUrl(candidate.url),
    description: candidate.description?.trim().replace(/\s+/g, ' '),
    publisher: candidate.publisher ? normalizeComparable(candidate.publisher) : undefined,
    packageId: candidate.packageId?.trim().toLowerCase(),
    bundleId: candidate.bundleId?.trim().toLowerCase(),
    platform: candidate.platform?.trim().toLowerCase(),
    observedAt: candidate.observedAt,
  };
}

export function contentFingerprint(brandId: string, candidate: CandidateInput): string {
  const normalized = normalizeEvidenceCandidate(candidate);
  normalized.brandId = brandId;
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

export function sourceReference(candidate: CandidateInput): string | undefined {
  return candidate.url ? normalizedUrl(candidate.url) : candidate.handle ? normalizeComparable(candidate.handle) : candidate.packageId?.trim().toLowerCase() ?? candidate.bundleId?.trim().toLowerCase();
}

export function createUserEvidence(
  brandId: string,
  candidate: CandidateInput,
  analysisId: string,
  now = new Date(),
): EvidenceRecord {
  const fingerprint = contentFingerprint(brandId, candidate);
  const observedAt = candidate.observedAt ? new Date(candidate.observedAt).toISOString() : undefined;
  return {
    evidenceId: `ev_${fingerprint.slice(0, 24)}`,
    brandId,
    analysisId,
    sourceType: 'user_submitted',
    sourceProvider: 'manual_submission',
    platform: candidate.platform,
    originalReference: sourceReference(candidate),
    collectedAt: now.toISOString(),
    observedAt,
    lastValidatedAt: now.toISOString(),
    validationStatus: candidate.description || candidate.url || candidate.handle || candidate.publisher || candidate.packageId || candidate.bundleId ? 'valid' : 'limited',
    evidenceType: evidenceTypeFor(candidate.sourceType),
    normalizedFields: Object.fromEntries(Object.entries(normalizeEvidenceCandidate(candidate)).filter(([key, value]) => key !== 'brandId' && value !== undefined)) as Record<string, string>,
    contentFingerprint: fingerprint,
    provenance: ['user_submitted', 'normalized'],
    validationErrors: [],
    limitations: ['User-submitted metadata was not independently verified.', 'Vikral did not fetch the submitted URL.'],
  };
}

export function createProviderEvidence(
  brandId: string,
  candidate: CandidateInput,
  analysisId: string,
  provider: string,
  providerRecordId: string,
  collectedAt: Date,
): EvidenceRecord {
  const fingerprint = contentFingerprint(brandId, candidate);
  const normalized = normalizeEvidenceCandidate(candidate);
  const observedAt = candidate.observedAt ? new Date(candidate.observedAt).toISOString() : undefined;
  return {
    evidenceId: `ev_${fingerprint.slice(0, 24)}`,
    brandId,
    analysisId,
    sourceType: 'authorized_api',
    sourceProvider: provider,
    platform: candidate.platform,
    originalReference: providerRecordId,
    collectedAt: collectedAt.toISOString(),
    observedAt,
    lastValidatedAt: new Date().toISOString(),
    validationStatus: 'valid',
    evidenceType: evidenceTypeFor(candidate.sourceType),
    normalizedFields: Object.fromEntries(Object.entries(normalized).filter(([key, value]) => key !== 'brandId' && value !== undefined)) as Record<string, string>,
    contentFingerprint: fingerprint,
    provenance: ['provider_retrieved', 'normalized'],
    validationErrors: [],
    limitations: ['Apple catalog presence is not independent authenticity verification.', 'Vikral did not treat this listing as proof that the app is safe or malicious.'],
  };
}

export function evidenceValidationError(candidate: CandidateInput): string[] {
  const errors: string[] = [];
  if (candidate.url) {
    const parsed = new URL(candidate.url);
    if (parsed.username || parsed.password) errors.push('URLs containing embedded credentials are not accepted.');
    if (parsed.port && !['80', '443'].includes(parsed.port)) errors.push('Only standard HTTP and HTTPS ports are accepted.');
  }
  if (candidate.sourceType === 'mobile_app' && candidate.platform === 'Android' && candidate.bundleId && !candidate.packageId) {
    errors.push('Android observations should use packageId rather than bundleId.');
  }
  if (candidate.sourceType === 'mobile_app' && candidate.platform === 'iOS' && candidate.packageId && !candidate.bundleId) {
    errors.push('iOS observations should use bundleId rather than packageId.');
  }
  return errors;
}

export function assertEvidenceSafe(candidate: CandidateInput): void {
  const errors = evidenceValidationError(candidate);
  if (errors.length) throw new EvidenceValidationError(errors);
}

export class EvidenceValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super('Evidence validation failed.');
  }
}
