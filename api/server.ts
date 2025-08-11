/**
 * local server entry file, for local development
 */

// 设置Node.js的一些限制以支持大文件上传
process.env.NODE_OPTIONS = '--max-old-space-size=8192'; // 增加内存限制到8GB

import app from './app.js';
import WebSocketManager from './websocket.js';
import { initDatabase } from './database.js';
import config from './config/index.js';
import { readUserConfig } from './routes/config.js';
import { fileCleanupScheduler } from './utils/fileCleanup.js';

// 全局WebSocket管理器实例
let wsManager: WebSocketManager | null = null;

/**
 * 获取WebSocket管理器实例
 */
export function getWebSocketManager(): WebSocketManager | null {
  return wsManager;
}

/**
 * 初始化数据库连接并启动服务器
 */
async function startServer() {
  try {
    // 初始化数据库连接
    console.log('正在初始化数据库连接...');
    await initDatabase(config.database);
    console.log('数据库连接初始化成功');
    
    // 启动HTTP服务器
    const PORT = process.env.PORT || 3001;
    const WS_PORT = process.env.WS_PORT || 8080;
    
    const server = app.listen(PORT, () => {
      console.log(`HTTP服务器启动在端口 ${PORT}`);
    });
    
    // 启动WebSocket服务器
    wsManager = new WebSocketManager(Number(WS_PORT));
    console.log(`WebSocket服务器启动在端口 ${WS_PORT}`);

    // 加载WebSocket安全配置
    try {
      const userConfig = await readUserConfig();
      if (userConfig.websocketSecurity?.enabled &&
          userConfig.websocketSecurity.key &&
          userConfig.websocketSecurity.value) {
        wsManager.setSecurityConfig(
          userConfig.websocketSecurity.key,
          userConfig.websocketSecurity.value
        );
        console.log(`WebSocket安全配置已加载: ${userConfig.websocketSecurity.key}`);
      } else {
        console.log('WebSocket安全配置未启用');
      }
    } catch (error) {
      console.warn('加载WebSocket安全配置失败:', error);
    }

    // 文件清理调度器已禁用，如需启用请手动调用 fileCleanupScheduler.start()
    // try {
    //   fileCleanupScheduler.start(24, false); // 每24小时清理一次，启动时不立即执行
    //   console.log('文件清理调度器已启动，将在24小时后开始定期清理');
    // } catch (error) {
    //   console.warn('启动文件清理调度器失败:', error);
    // }

    return { server, wsManager };
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
let server: ReturnType<typeof app.listen>;

startServer().then(({ server: s, wsManager: ws }) => {
  server = s;
  wsManager = ws;
});

// 导出WebSocket管理器供其他模块使用
export { wsManager };

/**
 * close server
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received');
  if (server) {
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received');
  if (server) {
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});

export default app;