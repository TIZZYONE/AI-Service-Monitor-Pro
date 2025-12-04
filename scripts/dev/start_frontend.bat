@echo off
REM 前端启动脚本（开发环境 - Windows）
REM 使用方法: 双击运行或在命令行执行

chcp 65001 >nul
echo ========================================
echo   启动前端服务
echo ========================================
echo.

REM 获取脚本所在目录
cd /d "%~dp0"
cd ..\..\frontend

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 16+
    pause
    exit /b 1
)

REM 检查npm是否安装
npm --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 npm，请先安装 npm
    pause
    exit /b 1
)

REM 检查前端依赖
if not exist "package.json" (
    echo [错误] 未找到 package.json
    pause
    exit /b 1
)

echo [检查] 前端依赖...
if not exist "node_modules" (
    echo [安装] 前端依赖未安装，正在安装...
    call npm install
)

echo.
echo [启动] 前端服务 (端口 3456)...
echo 按 Ctrl+C 停止服务
echo.

npm run dev

pause

