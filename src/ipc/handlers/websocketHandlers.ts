import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { ManagedApiRouter } from '../../services/ManagedApiRouter';

/**
 * Register WebSocket-related IPC handlers
 */
export function registerWebSocketHandlers(): void {
  const router = ManagedApiRouter.getInstance();

  // Get WebSocket connection state
  try { ipcMain.removeHandler('websocket:get-state'); } catch {}
  ipcMain.handle('websocket:get-state', async (_event: IpcMainInvokeEvent) => {
    try {
      return router.getWebSocketState();
    } catch (error) {
      console.error('Failed to get WebSocket state:', error);
      return 'disconnected';
    }
  });

  // Check if WebSocket is connected
  try { ipcMain.removeHandler('websocket:is-connected'); } catch {}
  ipcMain.handle('websocket:is-connected', async (_event: IpcMainInvokeEvent) => {
    try {
      return router.isWebSocketConnected();
    } catch (error) {
      console.error('Failed to check WebSocket connection:', error);
      return false;
    }
  });

  // Get WebSocket statistics
  try { ipcMain.removeHandler('websocket:get-stats'); } catch {}
  ipcMain.handle('websocket:get-stats', async (_event: IpcMainInvokeEvent) => {
    try {
      return router.getConnectionStats();
    } catch (error) {
      console.error('Failed to get WebSocket stats:', error);
      return {
        mode: 'personal',
        wsState: 'disconnected',
        wsConnected: false,
        wsStats: { state: 'disconnected', reconnectAttempts: 0, pendingRequests: 0 }
      };
    }
  });

  // Manually reconnect WebSocket
  try { ipcMain.removeHandler('websocket:reconnect'); } catch {}
  ipcMain.handle('websocket:reconnect', async (_event: IpcMainInvokeEvent) => {
    try {
      await router.reconnectWebSocket();
      return { success: true };
    } catch (error) {
      console.error('Failed to reconnect WebSocket:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  // Listen for WebSocket state changes and broadcast to renderer
  const wsClient = router.getWebSocketClient();
  wsClient.onStateChange((state) => {
    console.log(`🔌 WebSocket state changed: ${state}`);
    
    // Broadcast to all windows
    BrowserWindow.getAllWindows().forEach(window => {
      if (window && window.webContents) {
        window.webContents.send('websocket:state-changed', state);
      }
    });
  });

  console.log('✅ WebSocket IPC handlers registered');
}
