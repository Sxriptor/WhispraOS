import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPCRequest, IPCResponse } from '../messages';
import { ApiKeyManager } from '../../services/ApiKeyManager';
import { ApiKeyMigrationService } from '../../services/ApiKeyMigrationService';

/**
 * Register secure API key storage handlers
 */
export function registerSecureApiKeyHandlers(): void {
  // Get API keys
  try { ipcMain.removeHandler('secure-api-keys:get'); } catch {}
  ipcMain.handle('secure-api-keys:get', async (event, request: IPCRequest<void>) => {
    try {
      const apiKeyManager = ApiKeyManager.getInstance();
      const apiKeys = await apiKeyManager.getApiKeys();
      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: apiKeys
      };
    } catch (error) {
      console.error('Error getting secure API keys:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Set API keys
  try { ipcMain.removeHandler('secure-api-keys:set'); } catch {}
  ipcMain.handle('secure-api-keys:set', async (event, request: IPCRequest<{ apiKeys: Partial<import('../../types/ConfigurationTypes').ApiKeys> }>) => {
    try {
      const apiKeyManager = ApiKeyManager.getInstance();
      const { apiKeys } = request.payload;

      // Set each API key individually
      for (const [service, apiKey] of Object.entries(apiKeys)) {
        if (apiKey && apiKey.trim()) {
          await apiKeyManager.setApiKey(service as keyof import('../../types/ConfigurationTypes').ApiKeys, apiKey);
        }
      }

      return {
        id: request.id,
        timestamp: Date.now(),
        success: true
      };
    } catch (error) {
      console.error('Error setting secure API keys:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Remove API key
  try { ipcMain.removeHandler('secure-api-keys:remove'); } catch {}
  ipcMain.handle('secure-api-keys:remove', async (event, request: IPCRequest<{ service: keyof import('../../types/ConfigurationTypes').ApiKeys }>) => {
    try {
      console.log(`[IPC Handler] Removing API key for service: ${request.payload.service}`);
      const apiKeyManager = ApiKeyManager.getInstance();
      await apiKeyManager.removeApiKey(request.payload.service);
      console.log(`[IPC Handler] Successfully removed API key for service: ${request.payload.service}`);

      return {
        id: request.id,
        timestamp: Date.now(),
        success: true
      };
    } catch (error) {
      console.error('[IPC Handler] Error removing secure API key:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Clear all API keys
  try { ipcMain.removeHandler('secure-api-keys:clear-all'); } catch {}
  ipcMain.handle('secure-api-keys:clear-all', async (event, request: IPCRequest<void>) => {
    try {
      const apiKeyManager = ApiKeyManager.getInstance();
      await apiKeyManager.clearAllApiKeys();

      return {
        id: request.id,
        timestamp: Date.now(),
        success: true
      };
    } catch (error) {
      console.error('Error clearing secure API keys:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get storage config
  try { ipcMain.removeHandler('secure-api-keys:get-config'); } catch {}
  ipcMain.handle('secure-api-keys:get-config', async (event, request: IPCRequest<void>) => {
    try {
      const apiKeyManager = ApiKeyManager.getInstance();
      const storageConfig = apiKeyManager.getStorageConfig();

      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: storageConfig
      };
    } catch (error) {
      console.error('Error getting storage config:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Set storage config
  try { ipcMain.removeHandler('secure-api-keys:set-config'); } catch {}
  ipcMain.handle('secure-api-keys:set-config', async (event, request: IPCRequest<{ type: 'keychain' | 'passphrase' | 'none'; passphrase?: string }>) => {
    try {
      const apiKeyManager = ApiKeyManager.getInstance();
      const { type, passphrase } = request.payload;

      await apiKeyManager.configureStorage(type, passphrase);

      return {
        id: request.id,
        timestamp: Date.now(),
        success: true
      };
    } catch (error) {
      console.error('Error setting storage config:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Migrate API keys
  try { ipcMain.removeHandler('secure-api-keys:migrate'); } catch {}
  ipcMain.handle('secure-api-keys:migrate', async (event, request: IPCRequest<void>) => {
    try {
      const migrationService = ApiKeyMigrationService.getInstance();
      const result = await migrationService.migrateKeys();

      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: result
      };
    } catch (error) {
      console.error('Error during API key migration:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get migration status
  try { ipcMain.removeHandler('secure-api-keys:get-migration-status'); } catch {}
  ipcMain.handle('secure-api-keys:get-migration-status', async (event, request: IPCRequest<void>) => {
    try {
      const migrationService = ApiKeyMigrationService.getInstance();
      const status = await migrationService.getMigrationStatus();

      return {
        id: request.id,
        timestamp: Date.now(),
        success: true,
        payload: status
      };
    } catch (error) {
      console.error('Error getting migration status:', error);
      return {
        id: request.id,
        timestamp: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
}

