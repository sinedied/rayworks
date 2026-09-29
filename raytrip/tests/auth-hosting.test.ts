import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { loadRayfinConfig } from '../node_modules/@microsoft/rayfin-cli/dist/utils/config-utils.js';
import { toRuntimeSettingsServices } from '../node_modules/@microsoft/rayfin-tools-common/dist/services/runtime-settings/runtimeSettings.js';

it('serves branded frontend assets without disabling app authentication', () => {
  const config = loadRayfinConfig(resolve(import.meta.dirname, '..'), { silent: true });
  expect(config).toBeTruthy();
  const services = config!.services;
  expect(services.staticHosting?.assetAccess).toBe('public');
  expect(services.auth?.enabled).toBe(true);
  expect(services.auth?.fabric?.enabled).toBe(true);
  expect(services.data?.enabled).toBe(true);
  expect(services.functions?.enabled).toBe(true);
  expect(services.functions?.auth?.type).toBe('application');
  expect(services.storage?.enabled).toBe(false);
  const wire = toRuntimeSettingsServices(services);
  expect(wire.staticHosting?.anonymousAccess).toBe(true);
  expect(wire.auth).toEqual(services.auth);
  expect(wire.data).toEqual(services.data);
  expect(wire.functions).toEqual(services.functions);
});
