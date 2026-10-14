import type { EvidenceRecord } from './evidence.types.js';

export type ProviderStatus = 'connected' | 'not_configured' | 'unavailable' | 'error' | 'disabled';

export interface ProviderHealth {
  providerId: string;
  displayName: string;
  capabilities: string[];
  status: ProviderStatus;
  configurationRequired: boolean;
  lastSuccessfulSync?: string;
  lastError?: string;
}

export interface ProviderAdapter {
  id: string;
  displayName: string;
  capabilities: string[];
  validateConfiguration(): { configured: boolean; error?: string };
  healthCheck(): Promise<ProviderHealth>;
  fetchRecords(): Promise<EvidenceRecord[]>;
}

export interface AppleAppListing {
  selectionId: string;
  providerRecordId: string;
  appName: string;
  publisher: string;
  bundleId?: string;
  listingUrl?: string;
  platform: 'iOS';
  genre?: string;
  collectionTime: string;
  sourceProvider: 'apple_itunes_search';
}
