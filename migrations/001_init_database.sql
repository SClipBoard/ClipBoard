-- 剪切板同步服务数据库初始化脚本
-- 创建时间: 2024-01-01
-- 描述: 初始化剪切板内容表和设备表

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS clipboard_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE clipboard_db;

-- 创建剪切板内容表
CREATE TABLE IF NOT EXISTS clipboard_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    type ENUM('text', 'image') NOT NULL COMMENT '内容类型：文本或图片',
    content TEXT NOT NULL COMMENT '内容数据（文字内容或图片base64）',
    device_id VARCHAR(100) NOT NULL COMMENT '设备标识',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='剪切板内容表';



-- 创建索引以提高查询性能
-- 剪切板内容表索引
CREATE INDEX idx_clipboard_items_device_id ON clipboard_items(device_id) COMMENT '设备ID索引';
CREATE INDEX idx_clipboard_items_created_at ON clipboard_items(created_at DESC) COMMENT '创建时间索引（降序）';
CREATE INDEX idx_clipboard_items_type ON clipboard_items(type) COMMENT '内容类型索引';
CREATE INDEX idx_clipboard_items_type_created ON clipboard_items(type, created_at DESC) COMMENT '类型和创建时间复合索引';



-- 插入演示数据

-- 插入演示剪切板内容
INSERT INTO clipboard_items (id, type, content, device_id, created_at, updated_at) VALUES 
(UUID(), 'text', '欢迎使用剪切板同步服务！这是一个演示文本内容。', 'demo-device-1', NOW(), NOW()),
(UUID(), 'text', '这是另一个演示文本，展示多设备同步功能。', 'demo-device-2', DATE_SUB(NOW(), INTERVAL 30 MINUTE), DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(UUID(), 'text', '支持文字和图片的实时同步，让您在不同设备间无缝传输内容。', 'demo-device-1', DATE_SUB(NOW(), INTERVAL 1 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(UUID(), 'text', 'clipboard sync service - 跨设备剪切板同步', 'demo-device-2', DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 2 HOUR));

-- 创建用户和权限（可选，用于生产环境）
-- CREATE USER IF NOT EXISTS 'clipboard_user'@'localhost' IDENTIFIED BY 'your_secure_password';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON clipboard_db.* TO 'clipboard_user'@'localhost';
-- FLUSH PRIVILEGES;

-- 显示创建结果
SELECT 'Database initialization completed successfully!' as status;
SELECT COUNT(*) as clipboard_items_count FROM clipboard_items;