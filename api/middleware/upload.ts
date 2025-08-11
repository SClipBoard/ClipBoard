import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 上传文件存储目录
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * 生成唯一的文件名
 */
function generateUniqueFileName(originalName: string): string {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const uniqueId = uuidv4();
  return `${baseName}_${uniqueId}${ext}`;
}

/**
 * Multer存储配置
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueName = generateUniqueFileName(file.originalname);
    cb(null, uniqueName);
  }
});

/**
 * 文件过滤器 - 允许所有文件类型
 */
const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // 不限制文件类型，允许所有文件
  cb(null, true);
};

/**
 * Multer配置 - 不限制文件大小
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    // 设置一个非常大的文件大小限制（实际上不限制）
    fileSize: 1024 * 1024 * 1024 * 50, // 50GB
    // 允许的最大文件数量
    files: 10
  }
});

/**
 * 单文件上传中间件
 */
export const uploadSingle = upload.single('file');

/**
 * 多文件上传中间件
 */
export const uploadMultiple = upload.array('files', 10);

/**
 * 任意字段文件上传中间件
 */
export const uploadAny = upload.any();

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
export const uploadSingleMemory = memoryUpload.single('file');

/**
 * 内存多文件上传中间件
 */
export const uploadMultipleMemory = memoryUpload.array('files', 10);

export default upload;
