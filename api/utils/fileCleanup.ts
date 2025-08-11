import { ClipboardItemDAO } from '../database.js';
import { cleanupOrphanedFiles as cleanupOrphanedFilesFromStorage, listFiles, deleteFile } from './fileStorage.js';

/**
 * 清理孤立的文件（数据库中不存在的文件）
 */
export async function performOrphanedFilesCleanup(): Promise<{
  deletedCount: number;
  totalFiles: number;
  validFiles: number;
}> {
  try {
    console.log('开始清理孤立文件...');
    
    // 获取数据库中所有有效的文件路径
    const validFilePaths = await ClipboardItemDAO.getAllFilePaths();
    console.log(`数据库中有效文件路径数量: ${validFilePaths.length}`);
    
    // 获取存储目录中的所有文件
    const allFiles = await listFiles();
    console.log(`存储目录中文件总数: ${allFiles.length}`);
    
    // 清理孤立文件
    const deletedCount = await cleanupOrphanedFilesFromStorage(validFilePaths);
    
    const result = {
      deletedCount,
      totalFiles: allFiles.length,
      validFiles: validFilePaths.length
    };
    
    console.log('文件清理完成:', result);
    return result;
  } catch (error) {
    console.error('清理孤立文件失败:', error);
    throw error;
  }
}

/**
 * 清理数据库中引用但文件不存在的记录
 */
export async function cleanupMissingFileRecords(): Promise<{
  deletedRecords: number;
  checkedRecords: number;
}> {
  try {
    console.log('开始清理缺失文件的数据库记录...');
    
    // 获取所有文件类型的记录
    const fileItems = await ClipboardItemDAO.getByType('file');
    const imageItems = await ClipboardItemDAO.getByType('image');
    const allFileItems = [...fileItems, ...imageItems];
    
    console.log(`检查 ${allFileItems.length} 个文件记录...`);
    
    let deletedRecords = 0;
    
    for (const item of allFileItems) {
      if (item.filePath) {
        const { fileExists } = await import('./fileStorage.js');
        const exists = await fileExists(item.filePath);
        
        if (!exists) {
          console.log(`删除缺失文件的记录: ${item.id} - ${item.fileName}`);
          await ClipboardItemDAO.delete(item.id);
          deletedRecords++;
        }
      }
    }
    
    const result = {
      deletedRecords,
      checkedRecords: allFileItems.length
    };
    
    console.log('缺失文件记录清理完成:', result);
    return result;
  } catch (error) {
    console.error('清理缺失文件记录失败:', error);
    throw error;
  }
}

/**
 * 执行完整的文件清理
 */
export async function performFullFileCleanup(): Promise<{
  orphanedFiles: {
    deletedCount: number;
    totalFiles: number;
    validFiles: number;
  };
  missingRecords: {
    deletedRecords: number;
    checkedRecords: number;
  };
}> {
  try {
    console.log('开始执行完整文件清理...');
    
    // 先清理孤立文件
    const orphanedFiles = await performOrphanedFilesCleanup();
    
    // 再清理缺失文件的记录
    const missingRecords = await cleanupMissingFileRecords();
    
    const result = {
      orphanedFiles,
      missingRecords
    };
    
    console.log('完整文件清理完成:', result);
    return result;
  } catch (error) {
    console.error('完整文件清理失败:', error);
    throw error;
  }
}

/**
 * 定期文件清理任务
 */
export class FileCleanupScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * 启动定期清理任务
   * @param intervalHours 清理间隔（小时）
   * @param runImmediately 是否立即执行一次清理
   */
  start(intervalHours: number = 24, runImmediately: boolean = false): void {
    if (this.intervalId) {
      console.log('文件清理任务已在运行');
      return;
    }

    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`启动文件清理任务，间隔: ${intervalHours} 小时`);

    // 根据参数决定是否立即执行一次清理
    if (runImmediately) {
      this.runCleanup();
    }

    // 设置定期清理
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, intervalMs);
  }

  /**
   * 停止定期清理任务
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('文件清理任务已停止');
    }
  }

  /**
   * 执行清理任务
   */
  private async runCleanup(): Promise<void> {
    if (this.isRunning) {
      console.log('文件清理任务正在运行，跳过本次执行');
      return;
    }

    this.isRunning = true;
    
    try {
      console.log('开始定期文件清理任务...');
      const result = await performFullFileCleanup();
      console.log('定期文件清理任务完成:', result);
    } catch (error) {
      console.error('定期文件清理任务失败:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 手动触发清理
   */
  async triggerCleanup(): Promise<void> {
    await this.runCleanup();
  }

  /**
   * 获取任务状态
   */
  getStatus(): {
    isScheduled: boolean;
    isRunning: boolean;
  } {
    return {
      isScheduled: this.intervalId !== null,
      isRunning: this.isRunning
    };
  }
}

// 全局文件清理调度器实例
export const fileCleanupScheduler = new FileCleanupScheduler();
