import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { Request, Response, NextFunction } from 'express';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 上传文件存储目录
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * 修复中文文件名编码问题
 */
function fixChineseFileName(fileName: string): string {
  try {
    console.log('开始修复文件名编码:', fileName);

    // 检查是否包含明显的乱码字符
    const hasGarbledChars = /[ÃÂ¡Â¢Â£Â¤Â¥Â¦Â§Â¨Â©ÂªÂ«Â¬Â­Â®Â¯Â°Â±Â²Â³Â´ÂµÂ¶Â·Â¸Â¹ÂºÂ»Â¼Â½Â¾Â¿àáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ]/.test(fileName);

    if (hasGarbledChars) {
      console.log('检测到乱码字符，尝试修复...');

      // 尝试从Latin-1转换为UTF-8
      try {
        const buffer = Buffer.from(fileName, 'latin1');
        const decoded = buffer.toString('utf8');
        console.log('Latin-1转UTF-8结果:', decoded);

        // 检查是否包含中文字符
        if (/[\u4e00-\u9fff]/.test(decoded)) {
          console.log('修复成功，包含中文字符');
          return decoded;
        }
      } catch (e) {
        console.log('Latin-1转换失败:', e);
      }

      // 尝试其他编码
      const encodings = ['iso-8859-1', 'windows-1252'];
      for (const encoding of encodings) {
        try {
          const buffer = Buffer.from(fileName, encoding as BufferEncoding);
          const decoded = buffer.toString('utf8');
          console.log(`${encoding}转UTF-8结果:`, decoded);

          if (/[\u4e00-\u9fff]/.test(decoded)) {
            console.log(`${encoding}修复成功`);
            return decoded;
          }
        } catch (e) {
          console.log(`${encoding}转换失败:`, e);
        }
      }
    }

    // 如果没有乱码字符或修复失败，返回原文件名
    console.log('无需修复或修复失败，返回原文件名');
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
 * 文件过滤器 - 允许所有文件类型
 */
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 不限制文件类型，允许所有文件
  cb(null, true);
};

/**
 * 自定义存储配置，处理中文文件名编码
 */
const customStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // 在这里修复文件名编码
    const fixedOriginalName = fixChineseFileName(file.originalname);
    const uniqueName = generateUniqueFileName(fixedOriginalName);

    // 同时修复file.originalname以便后续使用
    file.originalname = fixedOriginalName;

    // 打印调试信息
    console.log('=== 文件上传调试信息 ===');
    console.log('原始文件名:', JSON.stringify(file.originalname));
    console.log('修复后文件名:', JSON.stringify(fixedOriginalName));
    console.log('生成的唯一文件名:', JSON.stringify(uniqueName));
    console.log('========================');

    cb(null, uniqueName);
  }
});

/**
 * Multer配置 - 不限制文件大小
 */
const upload = multer({
  storage: customStorage,
  fileFilter: fileFilter,
  limits: {
    // 设置一个非常大的文件大小限制（实际上不限制）
    fileSize: 1024 * 1024 * 1024 * 50, // 50GB
    // 允许的最大文件数量
    files: 10
  },
  // 确保正确处理中文文件名
  preservePath: false
});

/**
 * 修复上传文件的中文文件名编码
 */
function fixUploadedFileEncoding(req: any, res: any, next: any) {
  if (req.file && req.file.originalname) {
    req.file.originalname = fixChineseFileName(req.file.originalname);
  }
  if (req.files && Array.isArray(req.files)) {
    req.files.forEach((file: any) => {
      if (file.originalname) {
        file.originalname = fixChineseFileName(file.originalname);
      }
    });
  }
  next();
}

/**
 * 单文件上传中间件
 */
export const uploadSingle = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err) return next(err);
    fixUploadedFileEncoding(req, res, next);
  });
};

/**
 * 多文件上传中间件
 */
export const uploadMultiple = (req: Request, res: Response, next: NextFunction) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) return next(err);
    fixUploadedFileEncoding(req, res, next);
  });
};

/**
 * 任意字段文件上传中间件
 */
export const uploadAny = (req: Request, res: Response, next: NextFunction) => {
  upload.any()(req, res, (err) => {
    if (err) return next(err);
    fixUploadedFileEncoding(req, res, next);
  });
};

/**
 * 处理上传错误的中间件
 */
export const handleUploadError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: '文件处理错误，请检查文件是否损坏'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: '文件数量超出限制'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: '意外的文件字段'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `文件上传错误: ${error.message}`
        });
    }
  }
  
  if (error) {
    console.error('文件上传错误:', error);
    return res.status(500).json({
      success: false,
      message: '文件上传失败'
    });
  }
  
  next();
};

/**
 * 内存存储配置（用于临时处理）
 */
const memoryStorage = multer.memoryStorage();

/**
 * 内存上传配置 - 用于处理base64转换等场景
 */
const memoryUpload = multer({
  storage: memoryStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 1024 * 50, // 50GB，实际上不限制
    files: 10
  }
});

/**
 * 内存单文件上传中间件
 */
export const uploadSingleMemory = (req: Request, res: Response, next: NextFunction) => {
  memoryUpload.single('file')(req, res, (err) => {
    if (err) return next(err);
    fixUploadedFileEncoding(req, res, next);
  });
};

/**
 * 内存多文件上传中间件
 */
export const uploadMultipleMemory = (req: Request, res: Response, next: NextFunction) => {
  memoryUpload.array('files', 10)(req, res, (err) => {
    if (err) return next(err);
    fixUploadedFileEncoding(req, res, next);
  });
};

export default upload;
