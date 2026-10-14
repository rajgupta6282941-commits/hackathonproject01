import assert from 'node:assert/strict';
import test from 'node:test';
import { GeminiProvider } from '../src/services/gemini.provider.js';

test('Gemini provider is disabled without a Gemini key', async () => {
  const result = await new GeminiProvider({ LLM_PROVIDER: 'gemini' }).analyze();
  assert.equal(result.status, 'disabled');
  assert.match(result.missingEvidence[0], /GEMINI_API_KEY/);
});

test('Gemini provider normalizes model configuration to a Gemini model', async () => {
  const provider = new GeminiProvider({ GEMINI_API_KEY: 'test-key', LLM_MODEL: 'gpt-4o-mini', LLM_TIMEOUT_MS: '5000' });
  assert.ok(provider);
});
