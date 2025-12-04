# 开机自动启动服务配置指南

本指南介绍如何在Linux、Windows和Mac系统上配置服务开机自动启动。

## 🚀 一键启动脚本（开发/测试使用）

### Linux/Mac
```bash
# 给脚本添加执行权限
chmod +x start_all.sh

# 运行一键启动脚本（同时启动前后端）
./start_all.sh
```

### Windows
```cmd
# 双击运行或在命令行执行
start_all.bat
```

## 📦 开机自动启动配置

### Linux系统（推荐使用一键配置脚本）

#### 方法一：一键配置脚本（推荐）⭐

```bash
# 1. 给脚本添加执行权限
chmod +x scripts/config/setup_auto_start_linux.sh

# 2. 以管理员身份运行配置脚本
sudo ./scripts/config/setup_auto_start_linux.sh
```

脚本会自动：
- 检测Python路径（支持conda环境）
- 生成systemd服务文件
- 配置开机自启
- 可选择立即启动服务

#### 方法二：手动配置

1. **复制服务文件模板**

服务文件模板已创建在 `scripts/prod/ai-service-monitor.service`，请先编辑此文件，修改以下配置项（已用注释标注）：

```ini
[Unit]
Description=AI Service Monitor Pro Backend Service
After=network.target

[Service]
Type=simple
# ⚠️ 请修改以下配置项：
User=your_username                    # 运行服务的用户名
WorkingDirectory=/path/to/backend     # backend目录的完整路径
ExecStart=/usr/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8633  # Python路径

[Install]
WantedBy=multi-user.target
```

2. **复制到systemd目录并启用**

```bash
# 复制服务文件
sudo cp scripts/prod/ai-service-monitor.service /etc/systemd/system/

# 重新加载systemd配置
sudo systemctl daemon-reload

# 启用开机自启
sudo systemctl enable ai-service-monitor.service

# 启动服务
sudo systemctl start ai-service-monitor.service

# 查看服务状态
sudo systemctl status ai-service-monitor.service
```

### 3. 常用命令

```bash
# 停止服务
sudo systemctl stop ai-service-monitor.service

# 重启服务
sudo systemctl restart ai-service-monitor.service

# 禁用开机自启
sudo systemctl disable ai-service-monitor.service

# 查看日志
sudo journalctl -u ai-service-monitor.service -f
```

## Windows系统（推荐使用一键配置脚本）

### 方法一：一键配置脚本（推荐）⭐

1. **以管理员身份运行 PowerShell**
   - 右键点击 PowerShell，选择"以管理员身份运行"

2. **执行配置脚本**
   ```powershell
   cd D:\C\dev\caidb\AI-Service-Monitor-Pro
   .\scripts\config\setup_auto_start_windows.ps1
   ```

脚本会自动：
- 检测Python和Node.js环境
- 创建Windows计划任务
- 配置开机自启
- 可选择立即启动服务

### 方法二：手动配置（任务计划程序）

1. **打开任务计划程序**
   - 按 `Win + R`，输入 `taskschd.msc`，回车

2. **创建基本任务**
   - 点击右侧"创建基本任务"
   - 名称：`AI Service Monitor Pro`
   - 触发器：选择"当计算机启动时"
   - 操作：选择"启动程序"
   - 程序或脚本：浏览选择 `scripts/prod/start_backend.bat` 文件
   - 起始于：设置为 `backend` 目录的完整路径

3. **配置高级选项**
   - 右键任务 → 属性
   - 常规选项卡：
     - 勾选"不管用户是否登录都要运行"
     - 勾选"使用最高权限运行"
   - 条件选项卡：
     - 取消勾选"只有在计算机使用交流电源时才启动此任务"（如果需要）
   - 设置选项卡：
     - 勾选"允许按需运行任务"
     - 勾选"如果请求的任务运行，请立即运行"

4. **测试**
   - 右键任务 → 运行
   - 检查服务是否正常启动

## Mac系统（使用launchd）

### 1. 创建plist文件

创建文件 `~/Library/LaunchAgents/com.ai-service-monitor.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-service-monitor</string>
    <key>ProgramArguments</key>
    <array>
        <string>/path/to/python</string>
        <string>-m</string>
        <string>uvicorn</string>
        <string>main:app</string>
        <string>--host</string>
        <string>0.0.0.0</string>
        <string>--port</string>
        <string>8633</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/AI-Service-Monitor-Pro/backend</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/ai-service-monitor.out.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/ai-service-monitor.err.log</string>
</dict>
</plist>
```

**注意：**
- 将 `/path/to/python` 替换为实际Python路径（可使用 `which python3` 查看）
- 将 `/path/to/AI-Service-Monitor-Pro/backend` 替换为实际路径
- 如果使用conda环境，使用conda环境的Python路径

### 2. 加载服务

```bash
# 加载服务
launchctl load ~/Library/LaunchAgents/com.ai-service-monitor.plist

# 启动服务
launchctl start com.ai-service-monitor

# 查看服务状态
launchctl list | grep ai-service-monitor
```

### 3. 常用命令

```bash
# 停止服务
launchctl stop com.ai-service-monitor

# 卸载服务
launchctl unload ~/Library/LaunchAgents/com.ai-service-monitor.plist

# 查看日志
tail -f /tmp/ai-service-monitor.out.log
tail -f /tmp/ai-service-monitor.err.log
```

## 使用conda环境的配置示例

如果使用conda环境，需要：

1. **Linux systemd**：在 `ExecStart` 中使用conda环境的Python完整路径
2. **Windows**：在 `start_service.bat` 中添加 `call conda activate your_env_name`
3. **Mac launchd**：在 `ProgramArguments` 中使用conda环境的Python路径

## 📝 验证

配置完成后，重启系统，检查服务是否自动启动：

- **Linux**: `sudo systemctl status ai-service-monitor.service`
- **Windows**: 打开任务计划程序查看任务状态，或运行 `Get-ScheduledTask -TaskName "AI Service Monitor Pro"`
- **Mac**: `launchctl list | grep ai-service-monitor`

访问 `http://localhost:8633/health` 确认服务正常运行。

## 🔧 常用命令

### Linux
```bash
# 启动服务
sudo systemctl start ai-service-monitor.service

# 停止服务
sudo systemctl stop ai-service-monitor.service

# 重启服务
sudo systemctl restart ai-service-monitor.service

# 查看状态
sudo systemctl status ai-service-monitor.service

# 查看日志
sudo journalctl -u ai-service-monitor.service -f

# 禁用开机自启
sudo systemctl disable ai-service-monitor.service
```

### Windows
```powershell
# 启动服务
Start-ScheduledTask -TaskName "AI Service Monitor Pro"

# 停止服务
Stop-ScheduledTask -TaskName "AI Service Monitor Pro"

# 查看任务
Get-ScheduledTask -TaskName "AI Service Monitor Pro"

# 删除任务
Unregister-ScheduledTask -TaskName "AI Service Monitor Pro" -Confirm:$false
```

## ⚠️ 注意事项

1. **前端服务**：当前配置仅包含后端服务的自动启动。前端服务通常用于开发环境，生产环境建议使用 `npm run build` 构建后通过Nginx等Web服务器提供静态文件服务。

2. **端口占用**：确保端口8633（后端）和3456（前端）未被占用。

3. **权限问题**：Linux系统需要root权限配置systemd服务，Windows需要管理员权限配置计划任务。

4. **Conda环境**：如果使用conda环境，请确保在服务文件中使用conda环境的Python完整路径。

