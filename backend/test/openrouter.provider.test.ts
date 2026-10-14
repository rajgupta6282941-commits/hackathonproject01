import assert from 'node:assert/strict';
import test from 'node:test';
import { OpenRouterProvider } from '../src/services/openrouter.provider.js';

const context = {
  brandName: 'Vikral',
  candidate: { sourceType: 'social' as const, candidateName: 'Vikrall' },
  deterministicScore: 18,
  deterministicSignals: [{ code: 'NAME_SIMILARITY', category: 'identity', contribution: 18, explanation: 'Similar name.' }],
  trustedAssetExclusion: { excluded: false },
  evidenceReferences: ['candidateName:Vikrall', 'signal:NAME_SIMILARITY'],
};

test('OpenRouter provider is disabled without a key', async () => {
  const result = await new OpenRouterProvider({ LLM_PROVIDER: 'openrouter' }).analyze(context);
  assert.equal(result.status, 'disabled');
});

test('OpenRouter provider normalizes a compatible response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, 'POST');
    assert.match(String((init?.headers as Record<string, string>).Authorization), /^Bearer /);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
      contextualFindings: [{ code: 'CONTEXTUAL_SIMILARITY', explanation: 'Similar name warrants review.', supportingEvidence: ['candidateName:Vikrall'], limitations: ['No independent verification.'] }],
      missingEvidence: ['Ownership evidence.'],
      summary: 'Review the supplied similarity evidence.',
      recommendation: 'review',
    }) } }] }), { status: 200 });
  };
  try {
    const result = await new OpenRouterProvider({ OPENROUTER_API_KEY: 'test-key', LLM_MODEL: 'openai/gpt-4o-mini' }).analyze(context);
    assert.equal(result.status, 'completed');
    assert.equal(result.contextualFindings.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
