-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 派遣单表
CREATE TABLE IF NOT EXISTS dispatch_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    estimated_end_time DATETIME NOT NULL,
    end_time DATETIME,
    expiry_time DATETIME NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_dispatch_user ON dispatch_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_status ON dispatch_orders(status);
CREATE INDEX IF NOT EXISTS idx_dispatch_start_time ON dispatch_orders(start_time);
CREATE INDEX IF NOT EXISTS idx_dispatch_expiry_time ON dispatch_orders(expiry_time);