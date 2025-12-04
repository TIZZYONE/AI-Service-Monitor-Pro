# 启动脚本说明

本目录包含项目启动相关的所有脚本，按用途分类组织。

## 📁 目录结构

```
scripts/
├── dev/              # 开发环境启动脚本
│   ├── start_backend.sh      # Linux/Mac 后端启动
│   ├── start_backend.bat     # Windows 后端启动
│   ├── start_frontend.sh     # Linux/Mac 前端启动
│   ├── start_frontend.bat    # Windows 前端启动
│   ├── start_all.sh          # Linux/Mac 一键启动（前后端）
│   └── start_all.bat         # Windows 一键启动（前后端）
│
├── prod/             # 生产环境启动脚本
│   ├── start_backend.sh      # Linux/Mac 后端启动（用于systemd）
│   ├── start_backend.bat     # Windows 后端启动（用于任务计划）
│   └── ai-service-monitor.service  # Linux systemd 服务文件模板
│
└── config/           # 配置脚本
    ├── setup_auto_start_linux.sh    # Linux 一键配置开机自启
    └── setup_auto_start_windows.ps1 # Windows 一键配置开机自启
```

## 🚀 快速开始

### 开发环境

#### 方式一：分别启动（推荐）

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

#### 方式二：一键启动（前后端同时启动）

**Linux/Mac:**
```bash
chmod +x scripts/dev/start_all.sh
./scripts/dev/start_all.sh
```

**Windows:**
```cmd
scripts\dev\start_all.bat
```

### 生产环境

#### Linux 开机自启配置

```bash
# 一键配置（推荐）
chmod +x scripts/config/setup_auto_start_linux.sh
sudo ./scripts/config/setup_auto_start_linux.sh
```

#### Windows 开机自启配置

1. 以管理员身份运行 PowerShell
2. 执行：
```powershell
.\scripts\config\setup_auto_start_windows.ps1
```

## 📝 脚本说明

### 开发环境脚本 (dev/)

- **start_backend.sh/bat**: 仅启动后端服务（端口8633）
- **start_frontend.sh/bat**: 仅启动前端服务（端口3456）
- **start_all.sh/bat**: 同时启动前后端服务

### 生产环境脚本 (prod/)

- **start_backend.sh/bat**: 后端服务启动脚本（用于systemd/任务计划）
- **ai-service-monitor.service**: Linux systemd服务文件模板

### 配置脚本 (config/)

- **setup_auto_start_linux.sh**: Linux系统一键配置开机自启
- **setup_auto_start_windows.ps1**: Windows系统一键配置开机自启

## ⚙️ 使用建议

1. **开发环境**: 使用 `dev/` 目录下的脚本，前后端分离启动便于调试
2. **生产环境**: 使用 `prod/` 目录下的脚本配置系统服务
3. **首次配置**: 使用 `config/` 目录下的脚本一键完成配置

## 🔧 权限设置（Linux/Mac）

首次使用前需要给脚本添加执行权限：

```bash
chmod +x scripts/dev/*.sh
chmod +x scripts/prod/*.sh
chmod +x scripts/config/*.sh
```

