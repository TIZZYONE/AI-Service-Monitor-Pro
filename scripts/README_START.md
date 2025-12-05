# 快速启动指南

## 🚀 开发环境启动

### 方式一：分别启动（推荐）

**Linux/Mac:**
```bash
# 启动后端（在一个终端）
chmod +x scripts/dev/start_backend.sh
./scripts/dev/start_backend.sh

# 启动前端（在另一个终端）
chmod +x scripts/dev/start_frontend.sh
./scripts/dev/start_frontend.sh
```

**Windows:**
```cmd
REM 启动后端（在一个命令行窗口）
scripts\dev\start_backend.bat

REM 启动前端（在另一个命令行窗口）
scripts\dev\start_frontend.bat
```

### 方式二：一键启动（前后端同时启动）

**Linux/Mac:**
```bash
chmod +x scripts/dev/start_all.sh
./scripts/dev/start_all.sh
```

**Windows:**
```cmd
scripts\dev\start_all.bat
```

脚本会自动：
- ✅ 检查Python、Node.js、npm环境
- ✅ 检查并安装后端依赖（如果需要）
- ✅ 检查并安装前端依赖（如果需要）
- ✅ 启动后端服务（端口8633）
- ✅ 启动前端服务（端口3456）

启动成功后：
- 后端 API: http://localhost:8633
- 前端界面: http://localhost:3456

按 `Ctrl+C` 停止所有服务。

## 📦 开机自动启动配置

### Linux系统

**一键配置（推荐）：**
```bash
chmod +x scripts/config/setup_auto_start_linux.sh
sudo ./scripts/config/setup_auto_start_linux.sh
```

### Windows系统

**一键配置（推荐）：**

Windows提供了三个配置脚本，可根据需要选择：

1. **只配置后端开机启动：**
   ```powershell
   # 以管理员身份运行 PowerShell
   .\scripts\config\setup_auto_start_backend.ps1
   ```

2. **只配置前端开机启动：**
   ```powershell
   # 以管理员身份运行 PowerShell
   .\scripts\config\setup_auto_start_frontend.ps1
   ```

3. **同时配置前后端：**
   ```powershell
   # 以管理员身份运行 PowerShell
   .\scripts\config\setup_auto_start_windows.ps1
   ```

**任务名称：**
- 后端任务：`AI Service Monitor Pro - Backend`
- 前端任务：`AI Service Monitor Pro - Frontend`

详细配置说明请参考：`scripts/auto_start_guide.md`

## 📝 单独启动

### 后端服务
```bash
# Linux/Mac
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8633

# Windows
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8633
```

### 前端服务
```bash
cd frontend
npm install  # 首次运行需要安装依赖
npm run dev
```

## 🔧 生产环境部署

### 前端构建
```bash
cd frontend
npm run build
```

构建产物在 `frontend/dist` 目录，可以部署到Nginx等Web服务器。

### 后端服务
使用systemd（Linux）或任务计划程序（Windows）配置开机自启，参考 `backend/auto_start_guide.md`。

