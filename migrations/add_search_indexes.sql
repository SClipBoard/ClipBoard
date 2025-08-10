-- 添加搜索相关索引以提高搜索性能
-- 创建时间: 2024-01-01
-- 描述: 为搜索功能添加全文索引和普通索引

USE clipboard_db;

-- 为content字段添加全文索引（用于文本搜索）
ALTER TABLE clipboard_items 
ADD FULLTEXT INDEX idx_clipboard_content_fulltext (content) COMMENT '内容全文索引';

-- 为file_name字段添加索引（用于文件名搜索）
CREATE INDEX idx_clipboard_file_name ON clipboard_items(file_name) COMMENT '文件名索引';

-- 添加复合索引以优化搜索查询
CREATE INDEX idx_clipboard_search_composite ON clipboard_items(type, device_id, created_at DESC) COMMENT '搜索复合索引';

-- 显示索引创建结果
SELECT 'Search indexes added successfully!' as status;
SHOW INDEX FROM clipboard_items;
