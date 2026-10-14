import type { ProviderAdapter, ProviderHealth } from '../types/provider.types.js';
import { mockProvider } from './mock.provider.js';
import { appleAppStoreProvider } from './apple.provider.js';
import { blueskyProvider } from './bluesky.provider.js';

const adapters: ProviderAdapter[] = [appleAppStoreProvider, blueskyProvider, mockProvider];

export async function providerStatuses(): Promise<ProviderHealth[]> {
  return Promise.all(adapters.map((adapter) => adapter.healthCheck()));
}
