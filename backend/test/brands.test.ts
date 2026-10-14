import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import type { BrandRepository } from '../src/repositories/brand.repository.js';
import { validateBrandInput, ValidationError } from '../src/validation/brand.validation.js';
import { createBrandsRouter } from '../src/routes/brands.routes.js';
import express from 'express';

const id = '507f1f77bcf86cd799439011';
const input = {
  name: '  Vikral  ',
  officialWebsite: 'https://vikral.example/',
  industry: 'Security',
  description: 'Trusted profile',
  logoUrl: '',
  aliases: [' Vikral ', 'Vikral'],
  trustedDomains: ['HTTPS://VIKRAL.EXAMPLE/'],
  socialAccounts: [{ platform: 'LinkedIn', handle: ' vikral ', verificationStatus: 'unverified' }],
  mobileApps: [],
};

function fakeRepository(): BrandRepository {
  const stored = new Map<string, any>();
  const document = (value: any) => ({ ...value, _id: { toString: () => id }, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') });
  return {
    list: async () => [...stored.values()],
    findById: async (brandId) => stored.get(brandId) ?? null,
    create: async (value) => { const item = document(value); stored.set(id, item); return item; },
    update: async (brandId, value) => { if (!stored.has(brandId)) return null; const item = document(value); stored.set(brandId, item); return item; },
    delete: async (brandId) => stored.delete(brandId),
  };
}

describe('brand validation', () => {
  it('normalizes names, domains, aliases, and defaults asset verification explicitly', () => {
    const result = validateBrandInput(input);
    assert.equal(result.name, 'Vikral');
    assert.deepEqual(result.aliases, ['Vikral']);
    assert.deepEqual(result.trustedDomains, ['vikral.example']);
    assert.equal(result.socialAccounts[0].handle, 'vikral');
    assert.equal(result.socialAccounts[0].verificationStatus, 'unverified');
  });

  it('rejects missing names and malformed URLs', () => {
    assert.throws(() => validateBrandInput({ ...input, name: '' }), ValidationError);
    assert.throws(() => validateBrandInput({ ...input, officialWebsite: 'javascript:alert(1)' }), ValidationError);
  });

  it('allows a brand profile without a logo', () => {
    const { logoUrl: _logoUrl, ...withoutLogo } = input;
    assert.equal(validateBrandInput(withoutLogo).logoUrl, undefined);
  });
});

describe('brand routes', () => {
  it('creates, lists, retrieves, updates, and deletes a brand', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/brands', createBrandsRouter(fakeRepository()));
    const created = await request(app).post('/api/brands').send(input).expect(201);
    assert.equal(created.body.brand.name, 'Vikral');
    await request(app).get('/api/brands').expect(200);
    await request(app).get(`/api/brands/${id}`).expect(200);
    await request(app).put(`/api/brands/${id}`).send({ ...input, name: 'Updated Vikral' }).expect(200);
    await request(app).delete(`/api/brands/${id}`).expect(204);
    await request(app).get(`/api/brands/${id}`).expect(404);
  });

  it('rejects invalid identifiers before accessing storage', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/brands', createBrandsRouter(fakeRepository()));
    const response = await request(app).get('/api/brands/not-an-id').expect(400);
    assert.equal(response.body.error, 'Invalid brand identifier.');
  });
});
