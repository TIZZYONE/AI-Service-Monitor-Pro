@echo off
REM Windows 前端启动脚本（生产环境）
REM 使用方法：将此脚本添加到任务计划程序

REM 获取脚本所在目录并切换到frontend目录
cd /d "%~dp0"
cd ..\..\frontend

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 16+
    exit /b 1
)

REM 检查前端依赖
if not exist "node_modules" (
    echo [安装] 前端依赖未安装，正在安装...
    call npm install
)

REM 启动前端服务（生产环境 - 开发服务器模式）
REM 注意：生产环境建议使用 npm run build 构建后通过 Nginx 等 Web 服务器提供静态文件服务
REM 这里使用开发服务器模式是为了方便开发和生产环境统一管理
npm run dev

