import { RayfinClient } from '@microsoft/rayfin-client';

import type { UniversalAppSchema } from '../../rayfin/data/schema';
import type { AppFunctionsSchema } from '../../rayfin/functions/src/types';

export interface RayfinClientConfig {
  baseUrl: string;
  publishableKey: string;
  functionsBaseUrl?: string;
}

export class RaytripClient extends RayfinClient<UniversalAppSchema, AppFunctionsSchema> {}

let client: RaytripClient | null = null;

export function initRayfinClient(
  config: RayfinClientConfig
): RaytripClient {
  if (client) {
    throw new Error('Rayfin client is already initialized.');
  }
  client = new RaytripClient({
    baseUrl: config.baseUrl,
    publishableKey: config.publishableKey,
    authStorage: true,
    functionsBaseUrl: config.functionsBaseUrl,
  });
  return client;
}

export function getRayfinClient(): RaytripClient {
  if (!client) {
    throw new Error(
      'Rayfin client not initialized. Call bootstrapAuth() first.'
    );
  }
  return client;
}
