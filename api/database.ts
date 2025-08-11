import mysql, { Pool, ResultSetHeader } from 'mysql2/promise';
import type { ClipboardItem } from './types/shared';

// 数据库配置接口（扩展shared types中的DatabaseConfig）
interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  charset?: string;
}

// 数据库连接池
let pool: Pool | null = null;

/**
 * 检查表是否存在
 */
async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const sql = `
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() AND table_name = ?
    `;
    const result = await query<{ count: number }>(sql, [tableName]);
    return result[0]?.count > 0;
  } catch (error) {
    console.error(`检查表 ${tableName} 是否存在时出错:`, error);
    return false;
  }
}

/**
 * 创建剪切板内容表
 */
async function createClipboardItemsTable(): Promise<void> {
  const sql = `
    CREATE TABLE IF NOT EXISTS clipboard_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
        type ENUM('text', 'image', 'file') NOT NULL COMMENT '内容类型：文本、图片或文件',
        content LONGTEXT NOT NULL COMMENT '内容数据（文字内容或文件路径）',
        device_id VARCHAR(100) NOT NULL COMMENT '设备标识',
        file_name VARCHAR(255) NULL COMMENT '文件名（仅文件类型）',
        file_size BIGINT NULL COMMENT '文件大小（仅文件类型）',
        mime_type VARCHAR(100) NULL COMMENT 'MIME类型（仅文件类型）',
        file_path VARCHAR(500) NULL COMMENT '文件存储路径（仅文件类型）',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='剪切板内容表'
  `;
  
  await execute(sql);
  
  // 创建索引（MySQL不支持IF NOT EXISTS，所以使用try-catch处理）
  const indexes = [
    'CREATE INDEX idx_clipboard_items_device_id ON clipboard_items(device_id)',
    'CREATE INDEX idx_clipboard_items_created_at ON clipboard_items(created_at DESC)',
    'CREATE INDEX idx_clipboard_items_type ON clipboard_items(type)',
    'CREATE INDEX idx_clipboard_items_type_created ON clipboard_items(type, created_at DESC)'
  ];
  
  for (const indexSql of indexes) {
    try {
      await execute(indexSql);
    } catch (error) {
      // 索引已存在时会报错，这是正常的
      if (error instanceof Error && !error.message.includes('Duplicate key name')) {
        console.warn('创建索引时出现警告:', error.message);
      }
    }
  }
  
  console.log('剪切板内容表创建成功');
}

/**
 * 确保剪切板表有文件相关字段
 */
async function ensureFileFields(): Promise<void> {
  try {
    // 检查字段是否存在
    const columns = await query<{Field: string; Type: string}>('SHOW COLUMNS FROM clipboard_items');
    const columnNames = columns.map(col => col.Field);

    const requiredFields = ['file_name', 'file_size', 'mime_type', 'file_path'];
    const missingFields = requiredFields.filter(field => !columnNames.includes(field));
    
    if (missingFields.length > 0) {
      console.log('添加缺失的文件字段:', missingFields.join(', '));
      
      // 添加缺失的字段
      const alterSqls = [];
      if (missingFields.includes('file_name')) {
        alterSqls.push('ALTER TABLE clipboard_items ADD COLUMN file_name VARCHAR(255) NULL COMMENT \'文件名（仅文件类型）\'');
      }
      if (missingFields.includes('file_size')) {
        alterSqls.push('ALTER TABLE clipboard_items ADD COLUMN file_size BIGINT NULL COMMENT \'文件大小（仅文件类型）\'');
      }
      if (missingFields.includes('mime_type')) {
        alterSqls.push('ALTER TABLE clipboard_items ADD COLUMN mime_type VARCHAR(100) NULL COMMENT \'MIME类型（仅文件类型）\'');
      }
      if (missingFields.includes('file_path')) {
        alterSqls.push('ALTER TABLE clipboard_items ADD COLUMN file_path VARCHAR(500) NULL COMMENT \'文件存储路径（仅文件类型）\'');
      }
      
      for (const sql of alterSqls) {
        await execute(sql);
      }
    }
    
    // 检查并更新type字段的ENUM值
    const typeColumn = columns.find(col => col.Field === 'type');
    if (typeColumn && !typeColumn.Type.includes('file')) {
      console.log('更新type字段以支持file类型');
      await execute('ALTER TABLE clipboard_items MODIFY COLUMN type ENUM(\'text\', \'image\', \'file\') NOT NULL COMMENT \'内容类型：文本、图片或文件\'');
    }
    
    // 检查并确保content字段为LONGTEXT类型
    const contentColumn = columns.find(col => col.Field === 'content');
    if (contentColumn) {
      const currentType = contentColumn.Type.toLowerCase();
      if (!currentType.includes('longtext')) {
        console.log('更新content字段类型为LONGTEXT以支持大尺寸图片');
        await execute('ALTER TABLE clipboard_items MODIFY COLUMN content LONGTEXT NOT NULL COMMENT \'剪切板内容\'');
        console.log('content字段已更新为LONGTEXT类型');
      }
    } else {
      console.warn('未找到content字段');
    }
    
    console.log('文件字段检查完成');
  } catch (error) {
    console.error('检查文件字段时出错:', error);
    throw error;
  }
}



/**
 * 初始化数据库连接池
 */
export async function initDatabase(config: DatabaseConfig): Promise<void> {
  try {
    pool = mysql.createPool({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: config.charset || 'utf8mb4',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // 测试连接
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    
    console.log('数据库连接池初始化成功');
    
    // 检查并创建必要的表
    console.log('开始检查数据库表...');
    
    const clipboardTableExists = await checkTableExists('clipboard_items');
    if (!clipboardTableExists) {
      console.log('剪切板内容表不存在，正在创建...');
      await createClipboardItemsTable();
    } else {
      console.log('剪切板内容表已存在，检查字段...');
      // 检查是否有文件相关字段，如果没有则添加
      await ensureFileFields();
    }
    

    
    console.log('数据库表检查完成');
    
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 获取数据库连接
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }
  return pool;
}

/**
 * 执行SQL查询
 */
export async function query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const connection = await getPool().getConnection();
  try {
    const [rows] = await connection.execute(sql, params);
    return rows as T[];
  } finally {
    connection.release();
  }
}

/**
 * 执行SQL插入/更新/删除操作
 */
export async function execute(sql: string, params?: unknown[]): Promise<ResultSetHeader> {
  const connection = await getPool().getConnection();
  try {
    const [result] = await connection.execute(sql, params);
    return result as ResultSetHeader;
  } finally {
    connection.release();
  }
}

/**
 * 剪切板内容数据访问对象
 */
export class ClipboardItemDAO {
  /**
   * 获取剪切板内容列表
   */
  static async getItems(params: {
    page?: number;
    limit?: number;
    type?: 'text' | 'image' | 'file';
    search?: string;
    deviceId?: string;
  }): Promise<{ items: ClipboardItem[]; total: number }> {
    const { page = 1, limit = 20, type, search, deviceId } = params;
    const offset = (page - 1) * limit;
    
    // 确保limit和offset是整数
    const limitInt = parseInt(String(limit), 10);
    const offsetInt = parseInt(String(offset), 10);
    

    
    let whereClause = 'WHERE 1=1';
    const queryParams: unknown[] = [];
    
    if (type) {
      whereClause += ' AND type = ?';
      queryParams.push(type);
    }
    
    if (search) {
      // 只在文本类型中搜索内容，在所有类型中搜索文件名
      whereClause += ' AND ((type = "text" AND content LIKE ?) OR (file_name IS NOT NULL AND file_name LIKE ?))';
      queryParams.push(`%${search}%`);
      queryParams.push(`%${search}%`);
    }
    
    if (deviceId) {
      whereClause += ' AND device_id = ?';
      queryParams.push(deviceId);
    }
    
    // 获取总数
    const countSql = `SELECT COUNT(*) as total FROM clipboard_items ${whereClause}`;
    const countResult = await query<{ total: number }>(countSql, queryParams);
    const total = countResult[0]?.total || 0;
    
    // 获取数据（使用字符串拼接处理LIMIT和OFFSET，避免MySQL参数化查询问题）
    const dataSql = `
      SELECT id, type, content, device_id as deviceId,
             file_name as fileName, file_size as fileSize, mime_type as mimeType,
             file_path as filePath, created_at as createdAt, updated_at as updatedAt
      FROM clipboard_items
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `;

    const items = await query<ClipboardItem>(dataSql, queryParams);

    return { items, total };
  }
  
  /**
   * 根据ID获取剪切板内容
   */
  static async getById(id: string): Promise<ClipboardItem | null> {
    const sql = `
      SELECT id, type, content, device_id as deviceId,
             file_name as fileName, file_size as fileSize, mime_type as mimeType,
             file_path as filePath, created_at as createdAt, updated_at as updatedAt
      FROM clipboard_items
      WHERE id = ?
    `;
    
    const items = await query<ClipboardItem>(sql, [id]);
    return items[0] || null;
  }
  
  /**
   * 创建剪切板内容
   */
  static async create(item: Omit<ClipboardItem, 'createdAt' | 'updatedAt'>): Promise<ClipboardItem> {
    let sql: string;
    let params: unknown[];

    if (item.type === 'file' || item.type === 'image') {
      sql = `
        INSERT INTO clipboard_items (id, type, content, device_id, file_name, file_size, mime_type, file_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      // 将undefined值转换为null，避免MySQL错误
      params = [
        item.id,
        item.type,
        item.content,
        item.deviceId,
        item.fileName ?? null,
        item.fileSize ?? null,
        item.mimeType ?? null,
        item.filePath ?? null
      ];
    } else {
      sql = `
        INSERT INTO clipboard_items (id, type, content, device_id)
        VALUES (?, ?, ?, ?)
      `;
      params = [item.id, item.type, item.content, item.deviceId];
    }
    
    await execute(sql, params);
    
    const created = await this.getById(item.id);
    if (!created) {
      throw new Error('创建剪切板内容失败');
    }
    
    return created;
  }
  
  /**
   * 删除剪切板内容
   */
  static async delete(id: string): Promise<boolean> {
    // 先获取要删除的项目信息，以便删除对应的文件
    const item = await this.getById(id);

    // 删除数据库记录
    const sql = 'DELETE FROM clipboard_items WHERE id = ?';
    const result = await execute(sql, [id]);

    // 如果数据库删除成功且是文件类型，则删除对应的物理文件
    if (result.affectedRows > 0 && item && (item.type === 'file' || item.type === 'image') && item.filePath) {
      try {
        const { deleteFile } = await import('./utils/fileStorage.js');
        await deleteFile(item.filePath);
        console.log(`已删除文件: ${item.filePath}`);
      } catch (error) {
        console.error(`删除文件失败: ${item.filePath}`, error);
        // 文件删除失败不影响数据库删除的结果
      }
    }

    return result.affectedRows > 0;
  }
  
  /**
   * 按类型获取所有内容
   */
  static async getByType(type: 'text' | 'image' | 'file'): Promise<ClipboardItem[]> {
    const sql = `
      SELECT id, type, content, device_id as deviceId,
             file_name as fileName, file_size as fileSize, mime_type as mimeType,
             file_path as filePath, created_at as createdAt, updated_at as updatedAt
      FROM clipboard_items
      WHERE type = ?
      ORDER BY created_at DESC
    `;
    
    return await query<ClipboardItem>(sql, [type]);
  }
  
  /**
   * 获取最新的N个内容
   */
  static async getLatest(count: number): Promise<ClipboardItem[]> {
    const sql = `
      SELECT id, type, content, device_id as deviceId,
             file_name as fileName, file_size as fileSize, mime_type as mimeType,
             file_path as filePath, created_at as createdAt, updated_at as updatedAt
      FROM clipboard_items
      ORDER BY created_at DESC
      LIMIT ?
    `;
    
    return await query<ClipboardItem>(sql, [count]);
  }
  
  /**
   * 获取总数量
   */
  static async getCount(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM clipboard_items';
    const result = await query<{ count: number }>(sql);
    return result[0]?.count || 0;
  }
  
  /**
   * 按数量清理（保留最新的count个）
   */
  static async cleanupByCount(keepCount: number): Promise<number> {
    try {
      // 确保 keepCount 是一个有效的正整数
      const limit = Math.max(0, Math.floor(keepCount));

      // 先获取要保留的最新项目的ID，使用字符串拼接避免参数问题
      const keepItemsSql = `SELECT id FROM clipboard_items ORDER BY created_at DESC LIMIT ${limit}`;
      const keepItems = await query<{ id: string }>(keepItemsSql);

      if (keepItems.length === 0) {
        // 如果没有要保留的项目，先获取所有文件项目信息，然后删除所有项目
        const allFileItems = await query<{ id: string; filePath: string }>('SELECT id, file_path as filePath FROM clipboard_items WHERE (type = "file" OR type = "image") AND file_path IS NOT NULL');

        const deleteAllSql = 'DELETE FROM clipboard_items';
        const result = await execute(deleteAllSql);

        // 删除对应的物理文件
        if (result.affectedRows > 0 && allFileItems.length > 0) {
          const { deleteFile } = await import('./utils/fileStorage.js');
          for (const item of allFileItems) {
            if (item.filePath) {
              try {
                await deleteFile(item.filePath);
                console.log(`已删除文件: ${item.filePath}`);
              } catch (error) {
                console.error(`删除文件失败: ${item.filePath}`, error);
              }
            }
          }
        }

        return result.affectedRows;
      }

      // 先获取要删除的文件项目信息
      const keepIds = keepItems.map(item => item.id);
      const quotedIds = keepIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

      const toDeleteFileItems = await query<{ id: string; filePath: string }>(`SELECT id, file_path as filePath FROM clipboard_items WHERE (type = "file" OR type = "image") AND file_path IS NOT NULL AND id NOT IN (${quotedIds})`);

      // 删除不在保留列表中的项目
      const deleteSql = `DELETE FROM clipboard_items WHERE id NOT IN (${quotedIds})`;
      const result = await execute(deleteSql);

      // 删除对应的物理文件
      if (result.affectedRows > 0 && toDeleteFileItems.length > 0) {
        const { deleteFile } = await import('./utils/fileStorage.js');
        for (const item of toDeleteFileItems) {
          if (item.filePath) {
            try {
              await deleteFile(item.filePath);
              console.log(`已删除文件: ${item.filePath}`);
            } catch (error) {
              console.error(`删除文件失败: ${item.filePath}`, error);
            }
          }
        }
      }

      return result.affectedRows;
    } catch (error) {
      console.error('cleanupByCount 执行失败:', error);
      throw error;
    }
  }
  
  /**
   * 按日期清理（删除指定日期之前的内容）
   */
  static async cleanupByDate(beforeDate: Date): Promise<number> {
    const sql = 'DELETE FROM clipboard_items WHERE created_at < ?';
    const result = await execute(sql, [beforeDate.toISOString()]);
    return result.affectedRows;
  }

  /**
   * 获取文件类型的数量
   */
  static async getFileCount(): Promise<number> {
    const sql = 'SELECT COUNT(*) as count FROM clipboard_items WHERE type = "file"';
    const result = await query<{ count: number }>(sql);
    return result[0]?.count || 0;
  }

  /**
   * 按文件数量清理（保留最新的keepCount个文件）
   */
  static async cleanupFilesByCount(keepCount: number, strategy: 'oldest_first' | 'largest_first' = 'oldest_first'): Promise<number> {
    try {
      // 确保 keepCount 是一个有效的正整数
      const limit = Math.max(0, Math.floor(keepCount));

      console.log(`cleanupFilesByCount: keepCount=${keepCount}, limit=${limit}, strategy=${strategy}`);

      // 如果 limit 为 0，删除所有文件
      if (limit === 0) {
        // 先获取所有要删除的文件信息
        const allFileItems = await this.getByType('file');

        // 删除数据库记录
        const deleteSql = 'DELETE FROM clipboard_items WHERE type = \'file\'';
        const result = await execute(deleteSql);

        // 删除对应的物理文件
        if (result.affectedRows > 0) {
          const { deleteFile } = await import('./utils/fileStorage.js');
          for (const item of allFileItems) {
            if (item.filePath) {
              try {
                await deleteFile(item.filePath);
                console.log(`已删除文件: ${item.filePath}`);
              } catch (error) {
                console.error(`删除文件失败: ${item.filePath}`, error);
              }
            }
          }
        }

        console.log(`删除所有文件，删除数量: ${result.affectedRows}`);
        return result.affectedRows;
      }

      // 根据策略构建不同的SQL查询，使用字符串拼接避免参数问题
      let selectSql: string;
      if (strategy === 'largest_first') {
        // 按文件大小倒序，文件大小为空的按时间排序
        selectSql = `
          SELECT id FROM clipboard_items
          WHERE type = 'file'
          ORDER BY COALESCE(file_size, 0) DESC, created_at DESC
          LIMIT ${limit}
        `;
      } else {
        // 默认按时间倒序（最新的在前）
        selectSql = `
          SELECT id FROM clipboard_items
          WHERE type = 'file'
          ORDER BY created_at DESC
          LIMIT ${limit}
        `;
      }

      console.log(`执行查询: ${selectSql.trim()}`);
      const keepItems = await query<{ id: string }>(selectSql);
      console.log(`查询到要保留的文件数量: ${keepItems.length}`);

      if (keepItems.length === 0) {
        // 如果没有要保留的项目，删除所有文件
        const deleteSql = 'DELETE FROM clipboard_items WHERE type = \'file\'';
        const result = await execute(deleteSql);
        console.log(`没有要保留的文件，删除所有文件，删除数量: ${result.affectedRows}`);
        return result.affectedRows;
      }

      // 构建要保留的ID列表，使用字符串拼接避免参数问题
      const keepIds = keepItems.map(item => item.id);
      const quotedIds = keepIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');

      // 先获取要删除的文件信息
      const toDeleteSql = `SELECT id, file_path as filePath FROM clipboard_items WHERE type = 'file' AND id NOT IN (${quotedIds})`;
      const toDeleteItems = await query<{ id: string; filePath: string }>(toDeleteSql);

      // 删除不在保留列表中的文件记录
      const deleteSql = `DELETE FROM clipboard_items WHERE type = 'file' AND id NOT IN (${quotedIds})`;

      console.log(`执行删除: ${deleteSql}`);
      const result = await execute(deleteSql);

      // 删除对应的物理文件
      if (result.affectedRows > 0) {
        const { deleteFile } = await import('./utils/fileStorage.js');
        for (const item of toDeleteItems) {
          if (item.filePath) {
            try {
              await deleteFile(item.filePath);
              console.log(`已删除文件: ${item.filePath}`);
            } catch (error) {
              console.error(`删除文件失败: ${item.filePath}`, error);
            }
          }
        }
      }

      console.log(`删除完成，删除数量: ${result.affectedRows}`);
      return result.affectedRows;
    } catch (error) {
      console.error('cleanupFilesByCount 执行失败:', error);
      console.error('错误详情:', {
        keepCount,
        strategy,
        limit: Math.max(0, Math.floor(keepCount))
      });
      throw error;
    }
  }
  
  /**
   * 获取统计信息
   */
  static async getStats(): Promise<{
    totalItems: number;
    textItems: number;
    imageItems: number;
    fileItems: number;
    totalSize: number;
  }> {
    const sql = `
      SELECT 
        COUNT(*) as totalItems,
        SUM(CASE WHEN type = 'text' THEN 1 ELSE 0 END) as textItems,
        SUM(CASE WHEN type = 'image' THEN 1 ELSE 0 END) as imageItems,
        SUM(CASE WHEN type = 'file' THEN 1 ELSE 0 END) as fileItems,
        SUM(LENGTH(content)) as totalSize
      FROM clipboard_items
    `;
    
    const result = await query<{
      totalItems: number;
      textItems: number;
      imageItems: number;
      fileItems: number;
      totalSize: number;
    }>(sql);
    
    return result[0] || {
      totalItems: 0,
      textItems: 0,
      imageItems: 0,
      fileItems: 0,
      totalSize: 0
    };
  }
  
  /**
   * 删除所有内容
   */
  static async deleteAll(): Promise<number> {
    // 先获取所有文件项目信息
    const allFileItems = await query<{ id: string; filePath: string }>('SELECT id, file_path as filePath FROM clipboard_items WHERE (type = "file" OR type = "image") AND file_path IS NOT NULL');

    // 删除数据库记录
    const sql = 'DELETE FROM clipboard_items';
    const result = await execute(sql);

    // 删除对应的物理文件
    if (result.affectedRows > 0 && allFileItems.length > 0) {
      const { deleteFile } = await import('./utils/fileStorage.js');
      for (const item of allFileItems) {
        if (item.filePath) {
          try {
            await deleteFile(item.filePath);
            console.log(`已删除文件: ${item.filePath}`);
          } catch (error) {
            console.error(`删除文件失败: ${item.filePath}`, error);
          }
        }
      }
    }

    return result.affectedRows;
  }

  /**
   * 获取所有有效的文件路径
   */
  static async getAllFilePaths(): Promise<string[]> {
    const sql = `
      SELECT DISTINCT file_path
      FROM clipboard_items
      WHERE file_path IS NOT NULL AND file_path != ''
    `;

    const result = await query<{ file_path: string }>(sql);
    return result.map(row => row.file_path).filter(path => path);
  }

  /**
   * 清理过期内容
   */
  static async cleanup(params: { maxCount?: number; beforeDate?: string }): Promise<number> {
    let deletedCount = 0;
    
    if (params.beforeDate) {
      const sql = 'DELETE FROM clipboard_items WHERE created_at < ?';
      const result = await execute(sql, [params.beforeDate]);
      deletedCount += result.affectedRows;
    }
    
    if (params.maxCount) {
      const sql = `
        DELETE FROM clipboard_items 
        WHERE id NOT IN (
          SELECT id FROM (
            SELECT id FROM clipboard_items 
            ORDER BY created_at DESC 
            LIMIT ?
          ) as latest_items
        )
      `;
      const result = await execute(sql, [params.maxCount]);
      deletedCount += result.affectedRows;
    }
    
    return deletedCount;
  }
}



/**
 * 关闭数据库连接池
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('数据库连接池已关闭');
  }
}