-- 添加文件相关字段到clipboard_items表
ALTER TABLE clipboard_items 
ADD COLUMN IF NOT EXISTS file_name VARCHAR(255) NULL COMMENT '文件名（仅文件类型）',
ADD COLUMN IF NOT EXISTS file_size BIGINT NULL COMMENT '文件大小（仅文件类型）',
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) NULL COMMENT 'MIME类型（仅文件类型）';

-- 修改type字段以支持file类型
ALTER TABLE clipboard_items 
MODIFY COLUMN type ENUM('text', 'image', 'file') NOT NULL COMMENT '内