import { randomUUID } from 'node:crypto';
import type { BrandDocument } from '../models/brand.model.js';
import type { CandidateInput, DetectionResult, DetectionSignal, DetectionPriority } from '../types/detection.types.js';
import { normalizeComparable, normalizeHostname } from '../detection/normalize.js';
import { normalizedSimilarity } from '../detection/similarity.js';

export interface AIAnalysisContext {
  brandName: string;
  candidate: CandidateInput;
  deterministicScore: number;
  deterministicSignals: DetectionSignal[];
  trustedAssetExclusion: DetectionResult['trustedAssetExclusion'];
  evidenceReferences: string[];
}

export interface DisabledAIProvider {
  analyze(context?: AIAnalysisContext): Promise<DetectionResult['aiAnalysis']>;
}

export const disabledAIProvider: DisabledAIProvider = {
  async analyze() {
    return {
      status: 'disabled',
      contextualFindings: [],
      missingEvidence: ['No AI provider is configured.'],
      summary: 'AI interpretation is disabled; this result uses deterministic signals only.',
      recommendation: 'insufficient_evidence',
    };
  },
};

const unique = <T>(values: T[]) => [...new Set(values)];

function priority(score: number): DetectionPriority {
  if (score >= 76) return 'critical';
  if (score >= 51) return 'high';
  if (score >= 26) return 'medium';
  return 'low';
}

interface TrustedMatch { platform: string; identifier: string }
function assetMatches(candidate: CandidateInput, brand: BrandDocument): TrustedMatch | undefined {
  const candidateHost = normalizeHostname(candidate.url);
  const social = brand.socialAccounts.find((asset) =>
    candidate.sourceType === 'social' && (    (candidate.handle && normalizeComparable(candidate.handle) === normalizeComparable(asset.handle)) ||
      (candidate.url && asset.profileUrl && candidate.url.replace(/\/+$/, '') === asset.profileUrl.replace(/\/+$/, ''))));
  if (social && social.verificationStatus === 'verified') return { platform: social.platform, identifier: social.handle };
  const app = brand.mobileApps.find((asset) => candidate.sourceType === 'mobile_app' &&
    (    (candidate.packageId && asset.packageId && normalizeComparable(candidate.packageId) === normalizeComparable(asset.packageId)) ||
    (candidate.bundleId && asset.bundleId && normalizeComparable(candidate.bundleId) === normalizeComparable(asset.bundleId)) ||
      (candidate.url && asset.storeUrl && candidate.url.replace(/\/+$/, '') === asset.storeUrl.replace(/\/+$/, ''))));
  if (app && app.verificationStatus === 'verified') return { platform: app.platform, identifier: app.packageId ?? app.bundleId ?? app.appName };
  if (candidate.sourceType === 'website' && candidateHost && brand.trustedDomains.some((domain) => candidateHost === domain || candidateHost.endsWith(`.${domain}`))) {
    return { platform: 'website', identifier: candidateHost };
  }
  return undefined;
}

export async function analyzeCandidate(brand: BrandDocument, candidate: CandidateInput, aiProvider = disabledAIProvider): Promise<DetectionResult> {
  const brandName = brand.name;
  const signals: DetectionSignal[] = [];
  const nameSimilarity = Math.max(normalizedSimilarity(candidate.candidateName, brandName), ...brand.aliases.map((alias) => normalizedSimilarity(candidate.candidateName, alias)), 0);
  if (nameSimilarity >= 0.7) signals.push({ code: 'NAME_SIMILARITY', category: 'identity', contribution: Math.round(nameSimilarity * 25), explanation: `Candidate name is ${Math.round(nameSimilarity * 100)}% similar to the protected brand name.`, matchedField: 'candidateName', evidenceValue: candidate.candidateName, evidenceSource: 'user_provided' });
  if (candidate.description && brand.description && normalizedSimilarity(candidate.description, brand.description) >= 0.65) signals.push({ code: 'DESCRIPTION_SIMILARITY', category: 'identity', contribution: 10, explanation: 'Candidate description resembles the protected brand description.', matchedField: 'description', evidenceSource: 'user_provided' });
  const candidateHost = normalizeHostname(candidate.url);
  if (candidateHost && !brand.trustedDomains.some((domain) => candidateHost === domain || candidateHost.endsWith(`.${domain}`))) {
    signals.push({ code: 'UNTRUSTED_DOMAIN', category: 'provenance', contribution: 25, explanation: 'Candidate URL is outside the brand trusted-domain list.', matchedField: 'url', evidenceValue: candidateHost, evidenceSource: 'user_provided' });
  }
  if (candidate.sourceType === 'social' && candidate.handle && nameSimilarity >= 0.7 && !brand.socialAccounts.some((asset) => normalizeComparable(asset.handle) === normalizeComparable(candidate.handle!))) {
    signals.push({ code: 'UNVERIFIED_SOCIAL_SIMILARITY', category: 'social', contribution: 25, explanation: 'A similar social handle is not an exact verified asset in the brand profile.', matchedField: 'handle', evidenceValue: candidate.handle, evidenceSource: 'user_provided' });
  }
  if (candidate.sourceType === 'mobile_app' && candidate.publisher && normalizedSimilarity(candidate.publisher, brand.name) >= 0.7 && !brand.mobileApps.some((asset) => asset.verificationStatus === 'verified' && normalizedSimilarity(asset.publisher, candidate.publisher!) === 1)) {
    signals.push({ code: 'UNVERIFIED_APP_PUBLISHER', category: 'mobile_app', contribution: 25, explanation: 'The app publisher resembles the brand but is not a verified app asset.', matchedField: 'publisher', evidenceValue: candidate.publisher, evidenceSource: 'user_provided' });
  }
  if (candidate.sourceType === 'mobile_app' && brand.mobileApps.length > 0) {
    const identifierMatches = brand.mobileApps.some((asset) =>
      (candidate.packageId && asset.packageId && normalizeComparable(candidate.packageId) === normalizeComparable(asset.packageId)) ||
      (candidate.bundleId && asset.bundleId && normalizeComparable(candidate.bundleId) === normalizeComparable(asset.bundleId)));
    if ((candidate.packageId || candidate.bundleId) && !identifierMatches) {
      signals.push({ code: 'APP_IDENTIFIER_MISMATCH', category: 'mobile_app', contribution: 20, explanation: 'The submitted package or bundle identifier does not match a registered mobile app identifier.', matchedField: candidate.packageId ? 'packageId' : 'bundleId', evidenceValue: candidate.packageId ?? candidate.bundleId, evidenceSource: 'user_provided' });
    }
    if (candidate.publisher && !brand.mobileApps.some((asset) => normalizedSimilarity(asset.publisher, candidate.publisher!) === 1)) {
      signals.push({ code: 'APP_PUBLISHER_MISMATCH', category: 'mobile_app', contribution: 15, explanation: 'The submitted publisher does not match a registered mobile app publisher.', matchedField: 'publisher', evidenceValue: candidate.publisher, evidenceSource: 'user_provided' });
    }
  }
  const exclusion = assetMatches(candidate, brand);
  const deterministicScore = exclusion ? 0 : Math.min(100, unique(signals.map((signal) => signal.code)).reduce((total, code) => total + signals.find((signal) => signal.code === code)!.contribution, 0));
  let aiAnalysis: DetectionResult['aiAnalysis'];
  try {
    const evidenceReferences = unique([
      `candidateName:${candidate.candidateName}`,
      ...(candidate.handle ? [`handle:${candidate.handle}`] : []),
      ...(candidate.url ? [`url:${candidate.url}`] : []),
      ...(candidate.publisher ? [`publisher:${candidate.publisher}`] : []),
      ...(candidate.packageId ? [`packageId:${candidate.packageId}`] : []),
      ...(candidate.bundleId ? [`bundleId:${candidate.bundleId}`] : []),
      ...signals.map((signal) => `signal:${signal.code}`),
    ]);
    aiAnalysis = await aiProvider.analyze({
      brandName,
      candidate: { ...candidate },
      deterministicScore,
      deterministicSignals: signals,
      trustedAssetExclusion: exclusion ? { excluded: true, matchedAsset: exclusion.identifier, reason: `Verified ${exclusion.platform} asset matched.` } : { excluded: false },
      evidenceReferences,
    });
  } catch (error) {
    console.error('[vikral-api] AI analysis failed; returning deterministic result:', error);
    aiAnalysis = {
      status: 'failed',
      contextualFindings: [],
      missingEvidence: ['The optional AI provider failed; no AI interpretation is included.'],
      summary: 'AI interpretation failed; this result uses deterministic signals only.',
      recommendation: 'insufficient_evidence',
    };
  }
  const finalReasons = exclusion ? [`Matches a verified ${exclusion.platform} asset; excluded from risk scoring.`] : signals.map((signal) => signal.explanation);
  return {
    analysisId: randomUUID(), brandId: brand._id.toString(), sourceType: candidate.sourceType, candidate,
    matchedBrand: { id: brand._id.toString(), name: brand.name }, deterministicSignals: signals,
    deterministicScore, finalPriorityScore: deterministicScore, priority: priority(deterministicScore),
    trustedAssetExclusion: exclusion ? { excluded: true, matchedAsset: exclusion.identifier, reason: `Verified ${exclusion.platform} asset matched.` } : { excluded: false },
    aiAnalysis, finalReasons, limitations: ['No external providers were queried; candidate fields were supplied by the requester.', 'A review priority is not proof of fraud or a probability.'],
    analyzedAt: new Date().toISOString(),
  };
}
