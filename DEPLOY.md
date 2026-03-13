# Cloudflare 部署指南

## 前置要求
1. Cloudflare 账号（免费版即可）
2. Node.js 环境（本地开发用）
3. Wrangler CLI（Cloudflare 开发工具）

## 第一步：安装 Wrangler CLI

```bash
npm install -g wrangler
```

登录 Cloudflare：
```bash
wrangler login
```

## 第二步：创建 D1 数据库

1. 在 Cloudflare Dashboard 中创建 D1 数据库：
   - 访问 https://dash.cloudflare.com/
   - 进入 Workers & Pages → D1
   - 点击"Create database"
   - 名称：`dispatch_db`
   - 复制生成的 **Database ID**

2. 执行数据库 schema：
```bash
wrangler d1 execute dispatch_db --file=schema.sql --local  # 本地测试
wrangler d1 execute dispatch_db --file=schema.sql         # 生产环境
```

## 第三步：更新 wrangler.toml

将文件中的 `YOUR_DATABASE_ID` 替换为实际的 D1 数据库 ID：

```toml
[[d1_databases]]
binding = "DB"
database_name = "dispatch_db"
database_id = "YOUR_ACTUAL_DATABASE_ID"  # 替换这里
```

## 第四步：创建 R2 存储桶（可选）

1. 在 Cloudflare Dashboard 中：
   - 进入 R2 → Create bucket
   - 名称：`dispatch-storage`
   - 保持默认设置

2. （可选）如果需要存储文件，R2 已在 wrangler.toml 中配置好

## 第五步：部署到 Cloudflare Workers

### 方式一：命令行部署（推荐）

```bash
cd /home/admin/.openclaw/workspace/dispatch-app
npm install
wrangler deploy
```

### 方式二：通过 GitHub 自动部署

1. 在 Cloudflare Dashboard 中：
   - 进入 Workers & Pages → Create → Connect to Git
   - 选择你的 GitHub 仓库：`lp714726788/zyc1023`
   - 构建设置：
     - 框架预设：None
     - 构建命令：`npm install`
     - 输出目录：`/`（根目录）
   - 环境变量（如有需要）

2. 点击"Save and Deploy"

## 第六步：绑定 D1 数据库

如果使用 Workers 部署，需要在 Cloudflare Dashboard 中绑定 D1：

1. 进入你的 Worker 设置
2. Settings → Variables → D1 database bindings
3. 添加绑定：
   - Variable name: `DB`
   - D1 database: `dispatch_db`
4. 保存并重新部署

## 第七步：访问应用

部署成功后，你会获得一个 Worker URL，类似：
```
https://dispatch-app.YOUR_SUBDOMAIN.workers.dev
```

直接访问该 URL 即可使用派遣单管理系统。

## 功能说明

### 用户管理
- 注册新账号
- 登录认证
- 查看个人信息

### 派遣单管理
- **创建派遣单**：填写标题、描述、时间信息
- **时间字段**：
  - 开始时间（start_time）：派遣单开始时间
  - 预计结束时间（estimated_end_time）：预计完成时间
  - 结束时间（end_time）：实际结束时间（完成时自动填写）
  - 过期时间（expiry_time）：派遣单有效期限
- **状态管理**：
  - pending（待处理）
  - active（进行中）
  - completed（已完成）
  - expired（已过期）
- 派遣单列表查看
- 标记完成
- 删除派遣单

## API 端点

### 用户相关
- `POST /api/users/register` - 用户注册
- `POST /api/users/login` - 用户登录
- `GET /api/users/me` - 获取当前用户信息

### 派遣单相关
- `POST /api/dispatch` - 创建派遣单
- `GET /api/dispatch` - 获取用户的所有派遣单
- `GET /api/dispatch/:id` - 获取单个派遣单
- `PUT /api/dispatch/:id` - 更新派遣单
- `DELETE /api/dispatch/:id` - 删除派遣单

## 本地开发

```bash
# 启动本地开发服务器
wrangler dev

# 访问 http://localhost:8787
```

本地开发时使用本地 D1 数据库，不会影响生产环境。

## 注意事项

1. **安全性**：当前实现使用了简化的认证（用户 ID 作为 token），生产环境建议使用 JWT 或 OAuth
2. **密码存储**：目前使用 Base64 编码，生产环境应使用 bcrypt 等加密方式
3. **CORS**：已配置为允许所有来源，生产环境应限制为你的域名
4. **R2 存储**：当前预留了 R2 绑定，如果需要文件上传功能可以进一步开发

## 故障排查

### 部署失败
- 检查 wrangler.toml 中的 database_id 是否正确
- 确保已安装所有依赖：`npm install`

### 数据库错误
- 确保 D1 数据库已创建并执行了 schema.sql
- 检查 Workers 设置中的 D1 绑定是否正确

### API 调用失败
- 检查浏览器控制台的错误信息
- 确认用户已正确登录并获取了 token
- 检查 Workers 日志：`wrangler tail`

## 扩展建议

1. **多租户支持**：添加组织/团队概念
2. **权限管理**：细粒度的访问控制
3. **通知功能**：集成 Cloudflare Workers KV 或外部服务
4. **文件上传**：利用 R2 存储附件
5. **导出功能**：支持导出为 PDF 或 Excel
6. **移动端优化**：响应式设计改进

## 支持与帮助

如有问题，可以：
- 查看项目 README.md
- 访问 Cloudflare Workers 文档：https://developers.cloudflare.com/workers/
- 查看 D1 文档：https://developers.cloudflare.com/d1/