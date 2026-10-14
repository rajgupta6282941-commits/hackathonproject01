import type { DetectionSourceType } from './detection.types.js';

export type EvidenceSourceType = 'user_submitted' | 'authorized_api' | 'mock_provider';
export type EvidenceValidationStatus = 'valid' | 'limited' | 'invalid';
export type EvidenceType = 'social_profile' | 'mobile_app' | 'website';
export type ProvenanceLabel = 'user_submitted' | 'provider_retrieved' | 'normalized' | 'inferred' | 'independently_verified';

export interface EvidenceRecord {
  evidenceId: string;
  brandId: string;
  analysisId?: string;
  sourceType: EvidenceSourceType;
  sourceProvider: string;
  platform?: string;
  originalReference?: string;
  collectedAt: string;
  observedAt?: string;
  lastValidatedAt: string;
  validationStatus: EvidenceValidationStatus;
  evidenceType: EvidenceType;
  normalizedFields: Record<string, string>;
  contentFingerprint: string;
  provenance: ProvenanceLabel[];
  validationErrors: string[];
  limitations: string[];
  duplicateOf?: string;
}

export interface EvidenceCandidate {
  brandId: string;
  sourceType: DetectionSourceType;
  candidateName: string;
  handle?: string;
  url?: string;
  description?: string;
  publisher?: string;
  packageId?: string;
  bundleId?: string;
  platform?: string;
  observedAt?: string;
}
