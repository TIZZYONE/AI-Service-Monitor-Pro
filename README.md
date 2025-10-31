# 任务管理系统

一个基于 FastAPI 和 React 的全栈任务管理系统，支持定时任务调度、实时日志查看和任务状态监控。

## 功能特性

### 后端功能
- ✅ **任务管理**: 创建、查询、更新、删除任务
- ✅ **任务调度**: 支持一次性、每日、每周、每月重复执行
- ✅ **任务执行**: 自动执行激活命令和主程序命令
- ✅ **日志管理**: 自动保存任务执行日志，支持最多保存7个日志文件
- ✅ **实时监控**: WebSocket 实时推送任务状态和日志更新
- ✅ **API接口**: RESTful API 支持所有功能操作

### 前端功能
- ✅ **任务管理界面**: 直观的任务卡片展示和操作
- ✅ **任务表单**: 完整的任务创建和编辑表单
- ✅ **实时日志**: WebSocket 实时日志查看
- ✅ **日志下载**: 支持日志文件下载
- ✅ **响应式设计**: 适配不同屏幕尺寸
- ✅ **状态监控**: 实时显示任务运行状态

## 技术栈

### 后端
- **FastAPI**: 现代、快速的 Web 框架
- **SQLAlchemy**: ORM 数据库操作
- **SQLite**: 轻量级数据库
- **APScheduler**: 任务调度器
- **WebSocket**: 实时通信
- **Pydantic**: 数据验证

### 前端
- **React 18**: 现代 React 框架
- **TypeScript**: 类型安全
- **Ant Design**: UI 组件库
- **React Query**: 数据状态管理
- **React Router**: 路由管理
- **Vite**: 构建工具

## 项目结构

```
task_manager/
├── backend/                 # 后端代码
│   ├── api/                # API 路由
│   │   └── routes/         # 路由定义
│   ├── core/               # 核心功能
│   │   ├── database.py     # 数据库配置
│   │   └── scheduler.py    # 任务调度器
│   ├── models/             # 数据模型
│   ├── schemas/            # Pydantic 模式
│   ├── services/           # 业务逻辑
│   ├── main.py             # 应用入口
│   └── requirements.txt    # Python 依赖
└── frontend/               # 前端代码
    ├── src/
    │   ├── components/     # React 组件
    │   ├── hooks/          # 自定义 Hooks
    │   ├── pages/          # 页面组件
    │   ├── services/       # API 服务
    │   ├── types/          # TypeScript 类型
    │   └── main.tsx        # 应用入口
    ├── package.json        # Node.js 依赖
    └── vite.config.ts      # Vite 配置
```

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 后端启动

1. 进入后端目录：
```bash
cd task_manager/backend
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 启动服务：
```bash
python main.py
```

后端服务将在 `http://localhost:8000` 启动

### 前端启动

1. 进入前端目录：
```bash
cd task_manager/frontend
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

前端应用将在 `http://localhost:5173` 启动

## API 文档

启动后端服务后，可以访问以下地址查看 API 文档：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 主要 API 端点

### 任务管理
- `GET /api/tasks` - 获取所有任务
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/{id}` - 获取单个任务
- `PUT /api/tasks/{id}` - 更新任务
- `DELETE /api/tasks/{id}` - 删除任务
- `POST /api/tasks/{id}/start` - 手动启动任务
- `POST /api/tasks/{id}/stop` - 手动停止任务

### 日志管理
- `GET /api/logs/task/{task_id}` - 获取任务日志列表
- `GET /api/logs/task/{task_id}/latest` - 获取最新日志内容
- `DELETE /api/logs/task/{task_id}/cleanup` - 清理旧日志

### WebSocket
- `ws://localhost:8000/ws/logs/{task_id}` - 实时日志推送

## 使用说明

### 创建任务
1. 在任务管理页面点击"创建任务"
2. 填写任务信息：
   - **任务名称**: 任务的显示名称
   - **激活命令**: 任务执行前的准备命令（如激活虚拟环境）
   - **主程序命令**: 实际执行的程序命令
   - **重复类型**: 选择执行频率
   - **开始时间**: 任务首次执行时间
   - **结束时间**: 可选，任务停止时间

### 查看日志
1. 进入日志查看页面
2. 选择要查看的任务
3. 实时查看任务执行日志
4. 支持暂停、下载、清空等操作

### 任务调度
- 系统会根据设置的时间和重复类型自动执行任务
- 支持手动启动和停止任务
- 任务状态实时更新

## 注意事项

1. **日志管理**: 每个任务最多保存7个日志文件，每个文件最多10000行
2. **任务执行**: 确保激活命令和主程序命令的路径正确
3. **权限要求**: 某些命令可能需要特定的系统权限
4. **资源监控**: 长时间运行的任务请注意系统资源使用情况

## 开发说明

### 添加新功能
1. 后端：在相应的 `services`、`models`、`schemas` 中添加逻辑
2. 前端：在 `components`、`hooks`、`pages` 中添加界面和逻辑
3. API：在 `api/routes` 中添加新的端点

### 数据库迁移
当修改数据模型时，需要删除现有的数据库文件让系统重新创建，或者实现数据库迁移逻辑。

## 许可证

MIT License