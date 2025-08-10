import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { AppConfig, ApiResponse } from '../types/shared';
import { ClipboardItemDAO } from '../database.js';

const router: express.Router = express.Router();

// 系统默认配置
const defaultSystemConfig: AppConfig = {
  database: {
    host: 'localhost',
    port: 3306,
    user: 'clipboard_user',
    password: 'your_password',
    database: 'clipboard_db',
    charset: 'utf8mb4'
  },
  websocket: {
    port: 8080,
    heartbeatInterval: 30000,
    reconnectInterval: 5000,
    maxReconnectAttempts: 5
  },
  cleanup: {
    enabled: false,
    strategy: 'count',
    maxCount: 100,
    autoCleanInterval: 24
  }
};

// 前端设置默认配置
const defaultUserConfig = {
  maxItems: 1000,
  autoCleanupDays: 30
};

// 配置文件路径
const systemConfigPath = path.join(process.cwd(), 'config.json');
const userConfigPath = path.join(process.cwd(), 'user-config.json');

/**
 * 读取系统配置文件
 */
async function readSystemConfig(): Promise<AppConfig> {
  try {
    const configData = await fs.readFile(systemConfigPath, 'utf-8');
    return { ...defaultSystemConfig, ...JSON.parse(configData) };
  } catch {
    // 如果配置文件不存在，返回默认配置
    return defaultSystemConfig;
  }
}

/**
 * 写入系统配置文件
 */
async function writeSystemConfig(config: AppConfig): Promise<void> {
  await fs.writeFile(systemConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 读取用户配置文件
 */
async function readUserConfig(): Promise<typeof defaultUserConfig> {
  try {
    const configData = await fs.readFile(userConfigPath, 'utf-8');
    return { ...defaultUserConfig, ...JSON.parse(configData) };
  } catch {
    // 如果配置文件不存在，返回默认配置
    return defaultUserConfig;
  }
}

/**
 * 写入用户配置文件
 */
async function writeUserConfig(config: typeof defaultUserConfig): Promise<void> {
  await fs.writeFile(userConfigPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 获取客户端配置信息（仅包含前端需要的配置）
 * GET /api/config/client
 */
router.get('/client', async (req: Request, res: Response) => {
  try {
    // 从环境变量获取WebSocket端口
    const wsPort = process.env.WS_PORT || '3002';

    const clientConfig = {
      websocket: {
        port: parseInt(wsPort, 10)
      }
    };

    const response: ApiResponse<typeof clientConfig> = {
      success: true,
      data: clientConfig
    };

    res.json(response);
  } catch (error) {
    console.error('获取客户端配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取客户端配置失败'
    });
  }
});

/**
 * 获取用户配置信息（前端设置页面使用）
 * GET /api/config
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const config = await readUserConfig();

    const response: ApiResponse<typeof defaultUserConfig> = {
      success: true,
      data: config
    };

    res.json(response);
  } catch (error) {
    console.error('获取配置失败:', error);
    res.status(500).json({
      success: false,
      message: '获取配置失败'
    });
  }
});

/**
 * 更新用户配置信息（前端设置页面使用）
 * PUT /api/config
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const newConfig: Partial<typeof defaultUserConfig> = req.body;

    // 读取当前配置
    const currentConfig = await readUserConfig();

    // 合并配置
    const updatedConfig = {
      ...currentConfig,
      ...newConfig
    };

    // 写入配置文件
    await writeUserConfig(updatedConfig);

    const response: ApiResponse<typeof defaultUserConfig> = {
      success: true,
      data: updatedConfig,
      message: '配置更新成功'
    };

    res.json(response);
  } catch (error) {
    console.error('更新配置失败:', error);
    res.status(500).json({
      success: false,
      message: '更新配置失败'
    });
  }
});

/**
 * 清理过期内容
 * POST /api/config/cleanup
 */
router.post('/cleanup', async (req: Request, res: Response) => {
  try {
    const { maxCount, beforeDate }: { maxCount?: number; beforeDate?: string } = req.body;
    const userConfig = await readUserConfig();
    
    let deletedCount = 0;
    const originalCount = await ClipboardItemDAO.getCount();

    if (maxCount && typeof maxCount === 'number') {
      // 按数量清理：保留最新的 maxCount 个项目
      if (originalCount > maxCount) {
        deletedCount = await ClipboardItemDAO.cleanupByCount(maxCount);
      }
    } else if (beforeDate && typeof beforeDate === 'string') {
      // 按日期清理：删除指定日期之前的内容
      const cutoffDate = new Date(beforeDate);
      deletedCount = await ClipboardItemDAO.cleanupByDate(cutoffDate);
    } else {
      // 使用用户配置中的清理策略
      // 先按日期清理
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - userConfig.autoCleanupDays);
      deletedCount += await ClipboardItemDAO.cleanupByDate(cutoffDate);

      // 再按数量清理
      const currentCount = await ClipboardItemDAO.getCount();
      if (currentCount > userConfig.maxItems) {
        deletedCount += await ClipboardItemDAO.cleanupByCount(userConfig.maxItems);
      }
    }
    
    const remainingCount = await ClipboardItemDAO.getCount();
    
    const response: ApiResponse<{ deletedCount: number; remainingCount: number }> = {
      success: true,
      data: {
        deletedCount,
        remainingCount
      },
      message: `清理完成，删除了 ${deletedCount} 个项目`
    };

    res.json(response);
  } catch (error) {
    console.error('清理内容失败:', error);
    res.status(500).json({
      success: false,
      message: '清理内容失败'
    });
  }
});

/**
 * 清空所有内容
 * DELETE /api/config/clear-all
 */
router.delete('/clear-all', async (req: Request, res: Response) => {
  try {
    const deletedCount = await ClipboardItemDAO.deleteAll();

    const response: ApiResponse<{ deletedCount: number }> = {
      success: true,
      data: { deletedCount },
      message: `已清空所有内容，删除了 ${deletedCount} 个项目`
    };

    res.json(response);
  } catch (error) {
    console.error('清空所有内容失败:', error);
    res.status(500).json({
      success: false,
      message: '清空所有内容失败'
    });
  }
});

/**
 * 获取存储统计信息
 * GET /api/config/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await ClipboardItemDAO.getStats();
    
    const response: ApiResponse<{
      totalItems: number;
      textItems: number;
      imageItems: number;
      totalSize: string;
    }> = {
      success: true,
      data: {
        totalItems: stats.totalItems,
        textItems: stats.textItems,
        imageItems: stats.imageItems,
        totalSize: formatBytes(stats.totalSize)
      }
    };

    res.json(response);
  } catch (error) {
    console.error('获取存储统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取存储统计失败'
    });
  }
});

/**
 * 格式化字节大小
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 导出用户配置读取函数供其他模块使用
export { readUserConfig };

export default router;