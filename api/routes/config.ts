import express, { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import type { AppConfig, ApiResponse, CleanupRequest } from '../types/shared';
import { ClipboardItemDAO } from '../database.js';

const router: express.Router = express.Router();

// 默认配置
const defaultConfig: AppConfig = {
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

// 配置文件路径
const configPath = path.join(process.cwd(), 'config.json');

/**
 * 读取配置文件
 */
async function readConfig(): Promise<AppConfig> {
  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    return { ...defaultConfig, ...JSON.parse(configData) };
  } catch {
    // 如果配置文件不存在，返回默认配置
    return defaultConfig;
  }
}

/**
 * 写入配置文件
 */
async function writeConfig(config: AppConfig): Promise<void> {
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * 获取配置信息
 * GET /api/config
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const config = await readConfig();
    
    const response: ApiResponse<AppConfig> = {
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
 * 更新配置信息
 * PUT /api/config
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const newConfig: Partial<AppConfig> = req.body;
    
    // 读取当前配置
    const currentConfig = await readConfig();
    
    // 合并配置
    const updatedConfig: AppConfig = {
      database: { ...currentConfig.database, ...newConfig.database },
      websocket: { ...currentConfig.websocket, ...newConfig.websocket },
      cleanup: { ...currentConfig.cleanup, ...newConfig.cleanup }
    };
    
    // 写入配置文件
    await writeConfig(updatedConfig);
    
    const response: ApiResponse<AppConfig> = {
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
 * POST /api/cleanup
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { type, value }: CleanupRequest = req.body;
    const config = await readConfig();
    
    let deletedCount = 0;
    const originalCount = await ClipboardItemDAO.getCount();
    
    if (type === 'count' && typeof value === 'number') {
      // 按数量清理：保留最新的 value 个项目
      if (originalCount > value) {
        deletedCount = await ClipboardItemDAO.cleanupByCount(value);
      }
    } else if (type === 'date' && typeof value === 'string') {
      // 按日期清理：删除指定日期之前的内容
      const cutoffDate = new Date(value);
      deletedCount = await ClipboardItemDAO.cleanupByDate(cutoffDate);
    } else {
      // 使用配置文件中的清理策略
      if (config.cleanup.enabled) {
        if (config.cleanup.strategy === 'count' && config.cleanup.maxCount) {
          if (originalCount > config.cleanup.maxCount) {
            deletedCount = await ClipboardItemDAO.cleanupByCount(config.cleanup.maxCount);
          }
        } else if (config.cleanup.strategy === 'date' && config.cleanup.beforeDate) {
          const cutoffDate = new Date(config.cleanup.beforeDate);
          deletedCount = await ClipboardItemDAO.cleanupByDate(cutoffDate);
        } else if (config.cleanup.strategy === 'both') {
          // 先按日期清理
          if (config.cleanup.beforeDate) {
            const cutoffDate = new Date(config.cleanup.beforeDate);
            deletedCount += await ClipboardItemDAO.cleanupByDate(cutoffDate);
          }
          
          // 再按数量清理
          if (config.cleanup.maxCount) {
            const currentCount = await ClipboardItemDAO.getCount();
            if (currentCount > config.cleanup.maxCount) {
              deletedCount += await ClipboardItemDAO.cleanupByCount(config.cleanup.maxCount);
            }
          }
        }
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
 * 获取存储统计信息
 * GET /api/storage
 */
router.get('/storage', async (req: Request, res: Response) => {
  try {
    const stats = await ClipboardItemDAO.getStats();
    
    const response: ApiResponse<{
      totalItems: number;
      textItems: number;
      imageItems: number;
      totalSize: number;
      formattedSize: string;
    }> = {
      success: true,
      data: {
        totalItems: stats.totalItems,
        textItems: stats.textItems,
        imageItems: stats.imageItems,
        totalSize: stats.totalSize,
        formattedSize: formatBytes(stats.totalSize)
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

export default router;