import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contentFingerprint, createUserEvidence, evidenceValidationError, normalizeEvidenceCandidate } from '../src/validation/evidence.validation.js';
import { mockProvider } from '../src/providers/mock.provider.js';

describe('evidence validation and provenance', () => {
  it('normalizes equivalent observations to the same deterministic fingerprint', () => {
    const first = { sourceType: 'social' as const, candidateName: ' Vikral ', handle: '@Vikral-Copy', platform: 'Instagram' };
    const second = { sourceType: 'social' as const, candidateName: 'vikral', handle: '@vikral-copy', platform: 'Instagram' };
    assert.deepEqual(normalizeEvidenceCandidate(first), normalizeEvidenceCandidate(second));
    assert.equal(contentFingerprint('507f1f77bcf86cd799439011', first), contentFingerprint('507f1f77bcf86cd799439011', second));
  });

  it('keeps manual observations user-submitted and never independently verified', () => {
    const evidence = createUserEvidence('507f1f77bcf86cd799439011', {
      sourceType: 'social', candidateName: 'Vikral', handle: '@copy', platform: 'Instagram',
    }, 'analysis-1');
    assert.deepEqual(evidence.provenance, ['user_submitted', 'normalized']);
    assert.equal(evidence.provenance.includes('independently_verified'), false);
    assert.match(evidence.limitations.join(' '), /not independently verified/i);
  });

  it('rejects credentials and non-standard ports without fetching URLs', () => {
    const errors = evidenceValidationError({
      sourceType: 'social', candidateName: 'Vikral', handle: '@copy', url: 'https://user:secret@example.test:8443/profile',
    });
    assert.equal(errors.length, 2);
  });

  it('keeps the mock adapter disabled and clearly non-production', async () => {
    const health = await mockProvider.healthCheck();
    assert.equal(health.status, 'disabled');
    assert.match(health.lastError ?? '', /production/i);
    assert.deepEqual(await mockProvider.fetchRecords(), []);
  });
});
