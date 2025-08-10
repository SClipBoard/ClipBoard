import fs from 'fs';
import path from 'path';
import { logConfig, getLogPath } from '../config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: unknown;
}

class Logger {
  private logLevel: LogLevel;
  private logFile: string;

  constructor() {
    this.logLevel = this.getLogLevelFromString(logConfig.level);
    this.logFile = getLogPath();
    this.ensureLogDirectory();
  }

  private getLogLevelFromString(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case 'error':
        return LogLevel.ERROR;
      case 'warn':
        return LogLevel.WARN;
      case 'info':
        return LogLevel.INFO;
      case 'debug':
        return LogLevel.DEBUG;
      default:
        return LogLevel.INFO;
    }
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private formatMessage(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const logEntry: LogEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };
    return JSON.stringify(logEntry);
  }

  private writeToFile(message: string): void {
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private log(level: LogLevel, levelName: string, message: string, data?: unknown): void {
    if (level <= this.logLevel) {
      const formattedMessage = this.formatMessage(levelName, message, data);
      
      // 写入文件
      this.writeToFile(formattedMessage);
      
      // 控制台输出（开发环境）
      if (process.env.NODE_ENV === 'development') {
        const consoleMessage = `[${new Date().toISOString()}] ${levelName.toUpperCase()}: ${message}`;
        
        switch (level) {
          case LogLevel.ERROR:
            console.error(consoleMessage, data || '');
            break;
          case LogLevel.WARN:
            console.warn(consoleMessage, data || '');
            break;
          case LogLevel.INFO:
            console.info(consoleMessage, data || '');
            break;
          case LogLevel.DEBUG:
            console.debug(consoleMessage, data || '');
            break;
        }
      }
    }
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, 'error', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, 'warn', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, 'info', message, data);
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, 'debug', message, data);
  }

  // 清理旧日志文件
  cleanupOldLogs(daysToKeep: number = 7): void {
    try {
      const logDir = path.dirname(this.logFile);
      const files = fs.readdirSync(logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      files.forEach(file => {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime < cutoffDate) {
            fs.unlinkSync(filePath);
            this.info(`Deleted old log file: ${file}`);
          }
        }
      });
    } catch (error) {
      this.error('Failed to cleanup old logs', error);
    }
  }

  // 获取日志统计信息
  getLogStats(): { size: number; lines: number; lastModified: Date | null } {
    try {
      if (!fs.existsSync(this.logFile)) {
        return { size: 0, lines: 0, lastModified: null };
      }

      const stats = fs.statSync(this.logFile);
      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.split('\n').length - 1;

      return {
        size: stats.size,
        lines,
        lastModified: stats.mtime
      };
    } catch (error) {
      this.error('Failed to get log stats', error);
      return { size: 0, lines: 0, lastModified: null };
    }
  }

  // 读取最近的日志条目
  getRecentLogs(count: number = 100): LogEntry[] {
    try {
      if (!fs.existsSync(this.logFile)) {
        return [];
      }

      const content = fs.readFileSync(this.logFile, 'utf-8');
      const lines = content.trim().split('\n');
      const recentLines = lines.slice(-count);

      return recentLines
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line) as LogEntry;
          } catch {
            // 如果解析失败，返回一个简单的日志条目
            return {
              timestamp: new Date().toISOString(),
              level: 'INFO',
              message: line
            };
          }
        });
    } catch (error) {
      this.error('Failed to read recent logs', error);
      return [];
    }
  }

  // 搜索日志
  searchLogs(query: string, maxResults: number = 50): LogEntry[] {
    try {
      const allLogs = this.getRecentLogs(1000); // 搜索最近1000条日志
      const queryLower = query.toLowerCase();

      return allLogs
        .filter(log => 
          log.message.toLowerCase().includes(queryLower) ||
          log.level.toLowerCase().includes(queryLower) ||
          (log.data && JSON.stringify(log.data).toLowerCase().includes(queryLower))
        )
        .slice(-maxResults);
    } catch (error) {
      this.error('Failed to search logs', error);
      return [];
    }
  }
}

// 创建全局日志实例
const logger = new Logger();

// 导出日志实例
export default logger;

// 导出便捷函数
export const log = {
  error: (message: string, data?: unknown) => logger.error(message, data),
  warn: (message: string, data?: unknown) => logger.warn(message, data),
  info: (message: string, data?: unknown) => logger.info(message, data),
  debug: (message: string, data?: unknown) => logger.debug(message, data)
};

// 进程退出时的清理
process.on('exit', () => {
  logger.info('Application shutting down');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});