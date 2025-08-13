import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 上传文件存储目录
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * 确保上传目录存在
 */
async function ensureUploadsDir(): Promise<void> {
  try {
    await fs.access(UPLOADS_DIR);
  } catch {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('创建上传目录:', UPLOADS_DIR);
  }
}

/**
 * 修复中文文件名编码问题
 */
function fixChineseFileName(fileName: string): string {
  try {
    // 如果文件名已经是正确的UTF-8编码，直接返回
    if (isValidUTF8(fileName)) {
      return fileName;
    }

    // 尝试多种编码转换方式
    const encodings = ['latin1', 'iso-8859-1', 'windows-1252'];

    for (const encoding of encodings) {
      try {
        const buffer = Buffer.from(fileName, encoding as BufferEncoding);
        const decoded = buffer.toString('utf8');

        // 检查转换后的字符串是否包含合理的中文字符
        if (isValidUTF8(decoded) && /[\u4e00-\u9fff]/.test(decoded)) {
          console.log(`文件名编码修复成功: ${fileName} -> ${decoded}`);
          return decoded;
        }
      } catch (e) {
        // 继续尝试下一种编码
      }
    }

    return fileName;
  } catch (error) {
    console.warn('修复文件名编码失败:', error);
    return fileName;
  }
}

/**
 * 检查字符串是否为有效的UTF-8编码
 */
function isValidUTF8(str: string): boolean {
  try {
    return Buffer.from(str, 'utf8').toString('utf8') === str;
  } catch {
    return false;
  }
}

/**
 * 生成唯一的文件名
 */
function generateUniqueFileName(originalName: string): string {
  // 修复中文文件名编码问题
  const fixedName = fixChineseFileName(originalName);
  const ext = path.extname(fixedName);
  const baseName = path.basename(fixedName, ext);
  const uniqueId = uuidv4();
  return `${baseName}_${uniqueId}${ext}`;
}

/**
 * 保存文件到临时目录
 */
export async function saveFile(buffer: Buffer, originalName: string): Promise<string> {
  await ensureUploadsDir();
  
  const fileName = generateUniqueFileName(originalName);
  const filePath = path.join(UPLOADS_DIR, fileName);
  
  await fs.writeFile(filePath, buffer);
  console.log('文件已保存:', filePath);
  
  return fileName; // 返回相对文件名，不包含完整路径
}

/**
 * 从base64字符串保存文件
 */
export async function saveFileFromBase64(base64Data: string, originalName: string): Promise<string> {
  // 移除data URL前缀（如果存在）
  const base64Content = base64Data.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(base64Content, 'base64');
  
  return await saveFile(buffer, originalName);
}

/**
 * 读取文件
 */
export async function readFile(fileName: string): Promise<Buffer> {
  const filePath = path.join(UPLOADS_DIR, fileName);
  
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error('读取文件失败:', filePath, error);
    throw new Error(`文件不存在: ${fileName}`);
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(fileName: string): Promise<boolean> {
  const filePath = path.join(UPLOADS_DIR, fileName);
  
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 删除文件
 */
export async function deleteFile(fileName: string): Promise<boolean> {
  const filePath = path.join(UPLOADS_DIR, fileName);
  
  try {
    await fs.unlink(filePath);
    console.log('文件已删除:', filePath);
    return true;
  } catch (error) {
    console.error('删除文件失败:', filePath, error);
    return false;
  }
}

/**
 * 获取文件完整路径
 */
export function getFilePath(fileName: string): string {
  return path.join(UPLOADS_DIR, fileName);
}

/**
 * 获取文件信息
 */
export async function getFileInfo(fileName: string): Promise<{
  size: number;
  mtime: Date;
  exists: boolean;
}> {
  const filePath = path.join(UPLOADS_DIR, fileName);
  
  try {
    const stats = await fs.stat(filePath);
    return {
      size: stats.size,
      mtime: stats.mtime,
      exists: true
    };
  } catch {
    return {
      size: 0,
      mtime: new Date(),
      exists: false
    };
  }
}

/**
 * 清理不存在的文件（根据文件名列表）
 */
export async function cleanupOrphanedFiles(validFileNames: string[]): Promise<number> {
  await ensureUploadsDir();
  
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    let deletedCount = 0;
    
    for (const file of files) {
      if (!validFileNames.includes(file)) {
        const success = await deleteFile(file);
        if (success) {
          deletedCount++;
        }
      }
    }
    
    console.log(`清理了 ${deletedCount} 个孤立文件`);
    return deletedCount;
  } catch (error) {
    console.error('清理孤立文件失败:', error);
    return 0;
  }
}

/**
 * 获取上传目录中所有文件的列表
 */
export async function listFiles(): Promise<string[]> {
  await ensureUploadsDir();
  
  try {
    return await fs.readdir(UPLOADS_DIR);
  } catch (error) {
    console.error('获取文件列表失败:', error);
    return [];
  }
}

/**
 * 获取上传目录的总大小（字节）
 */
export async function getDirectorySize(): Promise<number> {
  await ensureUploadsDir();
  
  try {
    const files = await fs.readdir(UPLOADS_DIR);
    let totalSize = 0;
    
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      try {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      } catch {
        // 忽略无法访问的文件
      }
    }
    
    return totalSize;
  } catch (error) {
    console.error('计算目录大小失败:', error);
    return 0;
  }
}
