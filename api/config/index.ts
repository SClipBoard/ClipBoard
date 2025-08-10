import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config();

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigin: string;
}

export interface WebSocketConfig {
  port: number;
}

export interface UploadConfig {
  maxFileSize: number;
  uploadDir: string;
}

export interface SecurityConfig {
  jwtSecret: string;
}

export interface CleanupConfig {
  autoCleanupEnabled: boolean;
  autoCleanupDays: number;
  maxItemsPerDevice: number;
}

export interface LogConfig {
  level: string;
  file: string;
}

export interface AppConfig {
  database: DatabaseConfig;
  server: ServerConfig;
  websocket: WebSocketConfig;
  upload: UploadConfig;
  security: SecurityConfig;
  cleanup: CleanupConfig;
  log: LogConfig;
}

// 获取环境变量值，支持默认值
function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
}

// 获取数字类型的环境变量
function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return num;
}

// 获取布尔类型的环境变量
function getEnvBoolean(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value.toLowerCase() === 'true';
}

// 创建应用配置
function createConfig(): AppConfig {
  return {
    database: {
      host: getEnvVar('DB_HOST', 'localhost'),
      port: getEnvNumber('DB_PORT', 3306),
      user: getEnvVar('DB_USER', 'root'),
      password: getEnvVar('DB_PASSWORD', ''),
      database: getEnvVar('DB_NAME', 'clipboard_sync')
    },
    server: {
      port: getEnvNumber('PORT', 3001),
      nodeEnv: getEnvVar('NODE_ENV', 'development'),
      corsOrigin: getEnvVar('CORS_ORIGIN', 'http://localhost:5173')
    },
    websocket: {
      port: getEnvNumber('WS_PORT', 3002)
    },
    upload: {
      maxFileSize: getEnvNumber('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
      uploadDir: getEnvVar('UPLOAD_DIR', 'uploads')
    },
    security: {
      jwtSecret: getEnvVar('JWT_SECRET', 'default_jwt_secret_change_in_production')
    },
    cleanup: {
      autoCleanupEnabled: getEnvBoolean('AUTO_CLEANUP_ENABLED', true),
      autoCleanupDays: getEnvNumber('AUTO_CLEANUP_DAYS', 30),
      maxItemsPerDevice: getEnvNumber('MAX_ITEMS_PER_DEVICE', 1000)
    },
    log: {
      level: getEnvVar('LOG_LEVEL', 'info'),
      file: getEnvVar('LOG_FILE', 'logs/app.log')
    }
  };
}

// 验证配置
function validateConfig(config: AppConfig): void {
  // 验证数据库配置
  if (!config.database.host) {
    throw new Error('Database host is required');
  }
  if (config.database.port < 1 || config.database.port > 65535) {
    throw new Error('Database port must be between 1 and 65535');
  }
  if (!config.database.user) {
    throw new Error('Database user is required');
  }
  if (!config.database.database) {
    throw new Error('Database name is required');
  }

  // 验证服务器配置
  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Server port must be between 1 and 65535');
  }
  if (!['development', 'production', 'test'].includes(config.server.nodeEnv)) {
    throw new Error('NODE_ENV must be one of: development, production, test');
  }

  // 验证WebSocket配置
  if (config.websocket.port < 1 || config.websocket.port > 65535) {
    throw new Error('WebSocket port must be between 1 and 65535');
  }
  if (config.websocket.port === config.server.port) {
    throw new Error('WebSocket port cannot be the same as server port');
  }

  // 验证上传配置
  if (config.upload.maxFileSize < 1024) {
    throw new Error('Max file size must be at least 1KB');
  }
  if (config.upload.maxFileSize > 100 * 1024 * 1024) {
    throw new Error('Max file size cannot exceed 100MB');
  }

  // 验证安全配置
  if (config.security.jwtSecret.length < 32) {
    console.warn('Warning: JWT secret should be at least 32 characters long for security');
  }

  // 验证清理配置
  if (config.cleanup.autoCleanupDays < 1) {
    throw new Error('Auto cleanup days must be at least 1');
  }
  if (config.cleanup.maxItemsPerDevice < 10) {
    throw new Error('Max items per device must be at least 10');
  }

  // 验证日志配置
  if (!['error', 'warn', 'info', 'debug'].includes(config.log.level)) {
    throw new Error('Log level must be one of: error, warn, info, debug');
  }
}

// 创建并验证配置
let config: AppConfig;

try {
  config = createConfig();
  validateConfig(config);
  
  // 在开发环境下输出配置信息（隐藏敏感信息）
  if (config.server.nodeEnv === 'development') {
    console.log('Configuration loaded:', {
      ...config,
      database: {
        ...config.database,
        password: '***'
      },
      security: {
        ...config.security,
        jwtSecret: '***'
      }
    });
  }
} catch (error) {
  console.error('Configuration error:', error);
  process.exit(1);
}

export default config;

// 导出配置的各个部分
export const {
  database: databaseConfig,
  server: serverConfig,
  websocket: websocketConfig,
  upload: uploadConfig,
  security: securityConfig,
  cleanup: cleanupConfig,
  log: logConfig
} = config;

// 工具函数：检查是否为生产环境
export const isProduction = (): boolean => {
  return config.server.nodeEnv === 'production';
};

// 工具函数：检查是否为开发环境
export const isDevelopment = (): boolean => {
  return config.server.nodeEnv === 'development';
};

// 工具函数：检查是否为测试环境
export const isTest = (): boolean => {
  return config.server.nodeEnv === 'test';
};

// 工具函数：获取完整的上传目录路径
export const getUploadPath = (): string => {
  return path.resolve(process.cwd(), config.upload.uploadDir);
};

// 工具函数：获取完整的日志文件路径
export const getLogPath = (): string => {
  return path.resolve(process.cwd(), config.log.file);
};