import type { Brand, MobileApp, SocialAccount } from './brand.types.js';
import type { EvidenceRecord } from './evidence.types.js';

export type DetectionSourceType = 'social' | 'website' | 'mobile_app';

export interface CandidateInput {
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

export interface DetectionSignal {
  code: string;
  category: string;
  contribution: number;
  explanation: string;
  matchedField?: string;
  evidenceValue?: string;
  evidenceSource?: string;
}

export type DetectionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface DetectionResult {
  analysisId: string;
  brandId: string;
  sourceType: DetectionSourceType;
  candidate: CandidateInput;
  matchedBrand: Pick<Brand, 'id' | 'name'>;
  deterministicSignals: DetectionSignal[];
  deterministicScore: number;
  finalPriorityScore: number;
  priority: DetectionPriority;
  trustedAssetExclusion: { excluded: boolean; matchedAsset?: string; reason?: string };
  aiAnalysis: {
    status: 'disabled' | 'not_configured' | 'completed' | 'timeout' | 'error' | 'invalid_response' | 'unavailable' | 'failed';
    contextualFindings: Array<{ code: string; explanation: string; supportingEvidence: string[]; limitations: string[] }>;
    missingEvidence: string[];
    summary?: string;
    recommendation?: 'review' | 'monitor' | 'insufficient_evidence';
  };
  finalReasons: string[];
  limitations: string[];
  analyzedAt: string;
  evidence?: EvidenceRecord;
  duplicateEvidence?: boolean;
}

export type BrandAsset = SocialAccount | MobileApp;
