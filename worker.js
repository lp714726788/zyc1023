import { json } from 'itty-router';
import { Router } from 'itty-router';
import path from 'path';

const router = Router();

// CORS 中间件
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsify(response) {
    const newResponse = new Response(response.body, response);
    Object.entries(corsHeaders).forEach(([key, value]) => {
        newResponse.headers.set(key, value);
    });
    return newResponse;
}

// 预检请求
router.options('*', () => new Response(null, { headers: corsHeaders }));

// 用户认证（简化版，生产环境需要更安全的认证）
function authenticateUser(request, env) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.substring(7);
    // 简化的 token 验证，实际应该使用 JWT
    const userId = parseInt(token);
    if (isNaN(userId)) {
        return null;
    }
    return userId;
}

// 用户注册
router.post('/api/users/register', async (request, env) => {
    try {
        const { username, email, password } = await request.json();

        // 简单的密码哈希（生产环境应使用 bcrypt）
        const passwordHash = btoa(password);

        const result = await env.DB.prepare(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
        ).bind(username, email, passwordHash).run();

        return corsify(json({ success: true, userId: result.meta.last_row_id }));
    } catch (error) {
        return corsify(json({ success: false, error: error.message }, 400));
    }
});

// 用户登录
router.post('/api/users/login', async (request, env) => {
    try {
        const { username, password } = await request.json();
        const passwordHash = btoa(password);

        const result = await env.DB.prepare(
            'SELECT id, username FROM users WHERE username = ? AND password_hash = ?'
        ).bind(username, passwordHash).first();

        if (!result) {
            return corsify(json({ success: false, error: 'Invalid credentials' }, 401));
        }

        // 返回用户 ID 作为 token（简化版）
        return corsify(json({ success: true, token: result.id.toString(), user: result }));
    } catch (error) {
        return corsify(json({ success: false, error: error.message }, 400));
    }
});

// 获取当前用户信息
router.get('/api/users/me', async (request, env) => {
    const userId = authenticateUser(request, env);
    if (!userId) {
        return corsify(json({ success: false, error: 'Unauthorized' }, 401));
    }

    const user = await env.DB.prepare(
        'SELECT id, username, email, created_at FROM users WHERE id = ?'
    ).bind(userId).first();

    if (!user) {
        return corsify(json({ success: false, error: 'User not found' }, 404));
    }

    return corsify(json({ success: true, user }));
});

// 创建派遣单
router.post('/api/dispatch', async (request, env) => {
    const userId = authenticateUser(request, env);
    if (!userId) {
        return corsify(json({ success: false, error: 'Unauthorized' }, 401));
    }

    try {
        const { title, description, start_time, estimated_end_time, expiry_time } = await request.json();

        const result = await env.DB.prepare(
            `INSERT INTO dispatch_orders (user_id, title, description, start_time, estimated_end_time, expiry_time)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(userId, title, description, start_time, estimated_end_time, expiry_time).run();

        return corsify(json({ success: true, dispatchId: result.meta.last_row_id }));
    } catch (error) {
        return corsify(json({ success: false, error: error.message }, 400));
    }
});

// 获取用户的所有派遣单
router.get('/api/dispatch', async (request, env) => {
    const userId = authenticateUser(request, env);
    if (!userId) {
        return corsify(json({ success: false, error: 'Unauthorized' }, 401));
    }

    const orders = await env.DB.prepare(
        `SELECT * FROM dispatch_orders WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(userId).all();

    return corsify(json({ success: true, orders: orders.results }));
});

// 获取单个派遣单
router.get('/api/dispatch/:id', async (request, env) => {
    const userId = authenticateUser(request, env);
    if (!userId) {
        return corsify(json({ success: false, error: 'Unauthorized' }, 401));
    }

    const { id } = request.params;

    const order = await env.DB.prepare(
        'SELECT * FROM dispatch_orders WHERE id = ? AND user_id = ?'
    ).bind(id, userId).first();

    if (!order) {
        return corsify(json({ success: false, error: 'Dispatch order not found' }, 404));
    }

    return corsify(json({ success: true, order }));
});

// 更新派遣单
router.put('/api/dispatch/:id', async (request, env) => {
    const userId = authenticateUser(request, env);
    if (!userId) {
        return corsify(json({ success: false, error: 'Unauthorized' }, 401));
    }

    try {
        const { id } = request.params;
        const { title, description, start_time, estimated_end_time, end_time, expiry_time, status } = await request.json();

        const result = await env.DB.prepare(
            `UPDATE dispatch_orders
             SET title = ?, description = ?, start_time = ?, estimated_end_time = ?,
                 end_time = ?, expiry_time = ?, status = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND user_id = ?`
        ).bind(title, description, start_time, estimated_end_time, end_time, expiry_time, status, id, userId).run();

        if (result.meta.changes === 0) {
            return corsify(json({ success: false, error: 'Dispatch order not found or no changes' }, 404));
        }

        return corsify(json({ success: true }));
    } catch (error) {
        return corsify(json({ success: false, error: error.message }, 400));
    }
});

// 删除派遣单
router.delete('/api/dispatch/:id', async (request, env) => {
    const userId = authenticateUser(request, env);
    if (!userId) {
        return corsify(json({ success: false, error: 'Unauthorized' }, 401));
    }

    const { id } = request.params;

    const result = await env.DB.prepare(
        'DELETE FROM dispatch_orders WHERE id = ? AND user_id = ?'
    ).bind(id, userId).run();

    if (result.meta.changes === 0) {
        return corsify(json({ success: false, error: 'Dispatch order not found' }, 404));
    }

    return corsify(json({ success: true }));
});

// 静态文件服务
router.get('/', () => {
    return new Response(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>派遣单管理系统</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header h1 { color: #333; margin-bottom: 10px; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; font-weight: 500; }
        .form-group input, .form-group textarea, .form-group select {
            width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;
        }
        .form-group input[type="datetime-local"] { min-width: 200px; }
        button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
        button:hover { background: #0056b3; }
        .btn-secondary { background: #6c757d; }
        .btn-secondary:hover { background: #545b62; }
        .btn-danger { background: #dc3545; }
        .btn-danger:hover { background: #c82333; }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #218838; }
        .order-list { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .order-item { padding: 20px; border-bottom: 1px solid #eee; }
        .order-item:last-child { border-bottom: none; }
        .order-item h3 { color: #333; margin-bottom: 10px; }
        .order-item .times { margin: 10px 0; font-size: 13px; }
        .order-item .times div { margin: 5px 0; }
        .order-item .times span { color: #666; }
        .order-item .times strong { color: #333; }
        .order-item .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; margin-right: 10px; }
        .status-pending { background: #ffc107; color: #333; }
        .status-active { background: #28a745; color: white; }
        .status-completed { background: #007bff; color: white; }
        .status-expired { background: #dc3545; color: white; }
        .order-item .actions { margin-top: 10px; }
        .order-item .actions button { margin-right: 5px; }
        .login-form, .register-form { max-width: 400px; margin: 50px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .login-form h2, .register-form h2 { margin-bottom: 20px; color: #333; }
        .auth-nav { text-align: center; margin-top: 15px; }
        .auth-nav a { color: #007bff; text-decoration: none; }
        .auth-nav a:hover { text-decoration: underline; }
        .hidden { display: none; }
        .create-form { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .create-form h2 { margin-bottom: 15px; color: #333; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .full-width { grid-column: span 2; }
    </style>
</head>
<body>
    <div class="container">
        <!-- 登录表单 -->
        <div id="loginForm" class="login-form">
            <h2>登录</h2>
            <div class="form-group">
                <label>用户名</label>
                <input type="text" id="loginUsername" placeholder="请输入用户名">
            </div>
            <div class="form-group">
                <label>密码</label>
                <input type="password" id="loginPassword" placeholder="请输入密码">
            </div>
            <button onclick="login()">登录</button>
            <div class="auth-nav">
                还没有账号？<a href="#" onclick="showRegister()">注册</a>
            </div>
        </div>

        <!-- 注册表单 -->
        <div id="registerForm" class="register-form hidden">
            <h2>注册</h2>
            <div class="form-group">
                <label>用户名</label>
                <input type="text" id="regUsername" placeholder="请输入用户名">
            </div>
            <div class="form-group">
                <label>邮箱</label>
                <input type="email" id="regEmail" placeholder="请输入邮箱">
            </div>
            <div class="form-group">
                <label>密码</label>
                <input type="password" id="regPassword" placeholder="请输入密码">
            </div>
            <button onclick="register()">注册</button>
            <div class="auth-nav">
                已有账号？<a href="#" onclick="showLogin()">登录</a>
            </div>
        </div>

        <!-- 主应用 -->
        <div id="mainApp" class="hidden">
            <div class="header">
                <h1>派遣单管理系统</h1>
                <p>欢迎，<span id="username"></span>！</p>
                <button class="btn-secondary" onclick="logout()" style="margin-top: 10px;">退出登录</button>
            </div>

            <!-- 创建派遣单表单 -->
            <div class="create-form">
                <h2>创建新派遣单</h2>
                <div class="grid">
                    <div class="form-group full-width">
                        <label>标题</label>
                        <input type="text" id="dispatchTitle" placeholder="派遣单标题">
                    </div>
                    <div class="form-group full-width">
                        <label>描述</label>
                        <textarea id="dispatchDescription" rows="3" placeholder="派遣单描述"></textarea>
                    </div>
                    <div class="form-group">
                        <label>开始时间</label>
                        <input type="datetime-local" id="startTime">
                    </div>
                    <div class="form-group">
                        <label>预计结束时间</label>
                        <input type="datetime-local" id="estimatedEndTime">
                    </div>
                    <div class="form-group">
                        <label>过期时间</label>
                        <input type="datetime-local" id="expiryTime">
                    </div>
                </div>
                <button onclick="createDispatch()" style="margin-top: 15px;">创建派遣单</button>
            </div>

            <!-- 派遣单列表 -->
            <div class="order-list">
                <h2 style="padding: 20px; background: #f8f9fa; margin: 0; border-bottom: 1px solid #eee;">我的派遣单</h2>
                <div id="orderList"></div>
            </div>
        </div>
    </div>

    <script>
        let authToken = localStorage.getItem('authToken');
        let currentUsername = localStorage.getItem('username');

        // 页面加载时检查登录状态
        if (authToken) {
            showMainApp();
        }

        function showLogin() {
            document.getElementById('loginForm').classList.remove('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('mainApp').classList.add('hidden');
        }

        function showRegister() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.remove('hidden');
            document.getElementById('mainApp').classList.add('hidden');
        }

        function showMainApp() {
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('registerForm').classList.add('hidden');
            document.getElementById('mainApp').classList.remove('hidden');
            document.getElementById('username').textContent = currentUsername || '用户';
            loadOrders();
        }

        async function register() {
            const username = document.getElementById('regUsername').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;

            if (!username || !password) {
                alert('请填写用户名和密码');
                return;
            }

            try {
                const response = await fetch('/api/users/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, email, password })
                });
                const data = await response.json();

                if (data.success) {
                    alert('注册成功！请登录');
                    showLogin();
                } else {
                    alert('注册失败：' + data.error);
                }
            } catch (error) {
                alert('注册失败：' + error.message);
            }
        }

        async function login() {
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            if (!username || !password) {
                alert('请填写用户名和密码');
                return;
            }

            try {
                const response = await fetch('/api/users/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();

                if (data.success) {
                    authToken = data.token;
                    currentUsername = data.user.username;
                    localStorage.setItem('authToken', authToken);
                    localStorage.setItem('username', currentUsername);
                    showMainApp();
                } else {
                    alert('登录失败：' + data.error);
                }
            } catch (error) {
                alert('登录失败：' + error.message);
            }
        }

        function logout() {
            authToken = null;
            currentUsername = null;
            localStorage.removeItem('authToken');
            localStorage.removeItem('username');
            showLogin();
        }

        async function createDispatch() {
            const title = document.getElementById('dispatchTitle').value;
            const description = document.getElementById('dispatchDescription').value;
            const startTime = document.getElementById('startTime').value;
            const estimatedEndTime = document.getElementById('estimatedEndTime').value;
            const expiryTime = document.getElementById('expiryTime').value;

            if (!title || !startTime || !estimatedEndTime || !expiryTime) {
                alert('请填写必填字段');
                return;
            }

            try {
                const response = await fetch('/api/dispatch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authToken
                    },
                    body: JSON.stringify({
                        title,
                        description,
                        start_time: startTime,
                        estimated_end_time: estimatedEndTime,
                        expiry_time: expiryTime
                    })
                });
                const data = await response.json();

                if (data.success) {
                    alert('派遣单创建成功！');
                    document.getElementById('dispatchTitle').value = '';
                    document.getElementById('dispatchDescription').value = '';
                    document.getElementById('startTime').value = '';
                    document.getElementById('estimatedEndTime').value = '';
                    document.getElementById('expiryTime').value = '';
                    loadOrders();
                } else {
                    alert('创建失败：' + data.error);
                }
            } catch (error) {
                alert('创建失败：' + error.message);
            }
        }

        async function loadOrders() {
            try {
                const response = await fetch('/api/dispatch', {
                    headers: { 'Authorization': 'Bearer ' + authToken }
                });
                const data = await response.json();

                if (data.success) {
                    renderOrders(data.orders);
                } else {
                    alert('加载失败：' + data.error);
                }
            } catch (error) {
                alert('加载失败：' + error.message);
            }
        }

        function renderOrders(orders) {
            const container = document.getElementById('orderList');
            if (orders.length === 0) {
                container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">暂无派遣单</div>';
                return;
            }

            container.innerHTML = orders.map(order => {
                const statusClass = 'status-' + (order.status || 'pending');
                const statusText = {
                    'pending': '待处理',
                    'active': '进行中',
                    'completed': '已完成',
                    'expired': '已过期'
                }[order.status || 'pending'];

                return \`
                <div class="order-item">
                    <h3>\${order.title}</h3>
                    <p>\${order.description || '无描述'}</p>
                    <div class="times">
                        <div><span>开始时间：</span><strong>\${order.start_time}</strong></div>
                        <div><span>预计结束时间：</span><strong>\${order.estimated_end_time}</strong></div>
                        <div><span>结束时间：</span><strong>\${order.end_time || '未结束'}</strong></div>
                        <div><span>过期时间：</span><strong>\${order.expiry_time}</strong></div>
                    </div>
                    <div>
                        <span class="status \${statusClass}">\${statusText}</span>
                    </div>
                    <div class="actions">
                        <button onclick="markCompleted(\${order.id})" class="btn-success">标记完成</button>
                        <button onclick="deleteOrder(\${order.id})" class="btn-danger">删除</button>
                    </div>
                </div>
                \`;
            }).join('');
        }

        async function markCompleted(id) {
            if (!confirm('确定标记为已完成吗？')) return;

            try {
                const response = await fetch(\`/api/dispatch/\${id}\`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + authToken
                    },
                    body: JSON.stringify({
                        status: 'completed',
                        end_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
                    })
                });
                const data = await response.json();

                if (data.success) {
                    loadOrders();
                } else {
                    alert('操作失败：' + data.error);
                }
            } catch (error) {
                alert('操作失败：' + error.message);
            }
        }

        async function deleteOrder(id) {
            if (!confirm('确定删除此派遣单吗？')) return;

            try {
                const response = await fetch(\`/api/dispatch/\${id}\`, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + authToken }
                });
                const data = await response.json();

                if (data.success) {
                    loadOrders();
                } else {
                    alert('删除失败：' + data.error);
                }
            } catch (error) {
                alert('删除失败：' + error.message);
            }
        }
    </script>
</body>
</html>
    `, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
    });
});

// 404 处理
router.all('*', () => new Response('Not Found', { status: 404 }));

// 默认导出
export default {
    async fetch(request, env, ctx) {
        return router.handle(request, env, ctx).catch(error => {
            return new Response('Internal Server Error', { status: 500 });
        });
    }
};