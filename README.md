# 任务管理系统（AI Service Monitor Pro）

一个基于 FastAPI 与 React 的任务管理与监控系统，支持定时任务、实时日志、跨服务器管理，并提供多卡 GPU 显存与使用率的采集与展示。

## 功能特性

### 后端功能
- ✅ **任务管理**: 创建、查询、更新、删除任务
- ✅ **任务调度**: 支持一次性、每日、每周、每月重复执行
- ✅ **任务执行**: 自动执行激活命令和主程序命令
- ✅ **日志管理**: 自动保存任务执行日志，支持最多保存7个日志文件
- ✅ **实时监控**: WebSocket 实时推送任务状态和日志更新
- ✅ **API接口**: RESTful API 支持所有功能操作
 - ✅ **健康检查**: `GET /health` 返回系统资源与多卡 GPU 信息（需安装 NVIDIA 驱动并可用 `nvidia-smi`）

### 前端功能
- ✅ **任务管理界面**: 直观的任务卡片展示和操作
- ✅ **任务表单**: 完整的任务创建和编辑表单
- ✅ **实时日志**: WebSocket 实时日志查看
- ✅ **日志下载**: 支持日志文件下载
- ✅ **响应式设计**: 适配不同屏幕尺寸
- ✅ **状态监控**: 实时显示任务运行状态
 - ✅ **多服务器**: 通过本地配置管理多个后端服务器
 - ✅ **GPU 显存弹窗**: 头部标签显示总计显存（保留两位小数）与平均使用率，点击弹窗展示每张 GPU 的显存用量与百分比（显存两位小数、百分比一位小数）

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

## 项目结构（关键目录）

```
AI-Service-Monitor-Pro/
├── backend/                 # 后端代码
│   ├── api/                # API 路由
│   │   └── routes/         # 路由定义
│   ├── core/               # 核心功能
│   │   ├── database.py     # 数据库配置
│   │   └── scheduler.py    # 任务调度器
│   ├── models/             # 数据模型
│   ├── schemas/            # Pydantic 模式
│   ├── services/           # 业务逻辑
│   ├── main.py             # 应用入口（包含 /health）
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端代码
    ├── src/
    │   ├── components/     # React 组件
    │   ├── hooks/          # 自定义 Hooks
    │   ├── pages/          # 页面组件
    │   ├── services/       # API 服务（多服务器）
    │   ├── types/          # TypeScript 类型
    │   ├── utils/gpu.ts    # GPU 字符串解析与容错
    │   └── main.tsx        # 应用入口
    ├── package.json        # Node.js 依赖
    ├── vite.config.ts      # Vite 配置（提供 /config/servers 读写 API）
    └── data/servers.json   # 本地服务器配置文件（开发时生成与持久化）
```

## 快速开始

### 环境要求
- Python 3.8+
- Node.js 16+
- npm 或 yarn

### 后端启动

1. 进入后端目录：
```bash
cd backend
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

3. 启动服务：
```bash
python main.py
```

后端服务默认在 `http://localhost:8633` 启动（`backend/main.py` 中配置）。

### 前端启动

1. 进入前端目录：
```bash
cd frontend
```

2. 安装依赖：
```bash
npm install
```

3. 启动开发服务器：
```bash
npm run dev
```

Vite 会选择一个可用端口（示例：`http://localhost:3458/`）。请以终端提示为准。

> 开发模式下，前端提供 `/config/servers` 读写接口，配置会持久化到 `frontend/data/servers.json`。

## API 文档

本项目未内置自动生成的 Swagger 文档；核心接口如下：
- `GET /health` - 健康检查（含多卡 GPU 信息）
- `GET /api/tasks` - 获取所有任务
- `POST /api/tasks` - 创建任务
- `GET /api/tasks/{id}` - 获取单个任务
- `PUT /api/tasks/{id}` - 更新任务
- `DELETE /api/tasks/{id}` - 删除任务
- `POST /api/tasks/{id}/start` - 手动启动任务
- `POST /api/tasks/{id}/stop` - 手动停止任务
- `GET /api/logs/...` - 日志相关接口
- `ws://<host>:8633/ws/...` - WebSocket 实时日志

## 多服务器配置

前端在开发模式下通过 `vite.config.ts` 暴露 `/config/servers` 读写接口，并同步到 `frontend/data/servers.json`。你可以在“服务器管理”页面添加/编辑服务器，或直接修改 JSON 文件：

```json
[
  { "name": "H200", "host": "172.17.107.11", "port": 8633, "id": "1761874984714" },
  { "name": "H100", "host": "172.17.107.12", "port": 8633, "id": "1761880444426" }
]
```

前端会使用该配置请求每台服务器的 `/health` 并在头部展示系统与 GPU 信息。

## 健康检查返回示例

```json
{
  "status": "ok",
  "timestamp": "2025-10-31T02:16:53",
  "service": "任务管理系统",
  "version": "1.0.0",
  "system": {
    "cpu_usage": "12%",
    "memory_usage": "6.9%",
    "disk_usage": "55.7%",
    "memory_total": "2015GB",
    "disk_total": "878GB",
    "gpu_memory_usage": "88.9%",
    "gpu_memory_total": "1123.21GB",
    "gpu_percent_avg": 88.9,
    "gpus": [
      { "index": 0, "name": "NVIDIA GPU", "memory_used_mb": 125590, "memory_total_mb": 140401, "percent": 89.5, "utilization_percent": 85.9 },
      { "index": 1, "name": "NVIDIA GPU", "memory_used_mb": 125590, "memory_total_mb": 140401, "percent": 89.5, "utilization_percent": 89.5 }
    ]
  },
  "database": "connected",
  "scheduler": "running"
}
```

前端会将总计显存以两位小数显示（例如 `1123.21GB`），弹窗逐卡显存也保留两位小数（例如 `125.59GB / 140.40GB`），平均使用率以一位小数显示（例如 `89.5%`）。

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
4. **GPU 采集**: 后端通过 `nvidia-smi` 采集多卡信息，需安装并配置 NVIDIA 驱动；无 GPU 或命令不可用时，返回不包含 GPU 字段
5. **资源监控**: 长时间运行的任务请注意系统资源使用情况

## 开发说明

### 添加新功能
1. 后端：在相应的 `services`、`models`、`schemas` 中添加逻辑
2. 前端：在 `components`、`hooks`、`pages` 中添加界面和逻辑
3. API：在 `api/routes` 中添加新的端点

### 数据库迁移
当修改数据模型时，需要删除现有的数据库文件让系统重新创建，或者实现数据库迁移逻辑。

## 许可证

MIT License