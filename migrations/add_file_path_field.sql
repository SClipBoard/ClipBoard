-- 添加文件路径字段到剪切板内容表
-- 执行日期: 2024-08-11
-- 描述: 为支持文件存储到临时目录而不是base64，添加file_path字段

-- 检查并添加file_path字段
ALTER TABLE clipboard_items 
ADD COLUMN IF NOT EXISTS file_path VARCHAR(500) NULL COMMENT '文件存储路径（仅文件类型）';

-- 更新content字段注释
ALTER TABLE clipboard_items 
MODIFY COLUMN content LONGTEXT NOT NULL COMMENT '内容数据（文字内容或文件路径）';

-- 创建file_path字段的索引（可选，用于优化查询）
CREATE INDEX IF NOT EXISTS idx_clipboard_items_file_path ON clipboard_items(file_path);

-- 显示表结构确认更改
DESCRIBE clipboard_items;
