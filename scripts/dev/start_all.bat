@echo off
REM 一键启动脚本 - 同时启动前端和后端（开发环境 - Windows）
REM 使用方法: 双击运行或在命令行执行

chcp 65001 >nul
echo ========================================
echo   AI Service Monitor Pro 一键启动
echo ========================================
echo.

REM 获取脚本所在目录
cd /d "%~dp0"
cd ..\..

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

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

REM 检查后端依赖
if exist "backend\requirements.txt" (
    echo [检查] 后端依赖...
    python -c "import uvicorn" >nul 2>&1
    if errorlevel 1 (
        echo [安装] 后端依赖未安装，正在安装...
        cd backend
        pip install -r requirements.txt
        cd ..
    )
)

REM 检查前端依赖
if exist "frontend\package.json" (
    echo [检查] 前端依赖...
    if not exist "frontend\node_modules" (
        echo [安装] 前端依赖未安装，正在安装...
        cd frontend
        call npm install
        cd ..
    )
)

echo.
echo [启动] 后端服务 (端口 8633)...
cd backend
start "AI Service Monitor Backend" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8633"
cd ..
timeout /t 3 /nobreak >nul

echo [启动] 前端服务 (端口 3456)...
cd frontend
start "AI Service Monitor Frontend" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo   服务启动成功！
echo ========================================
echo 后端 API: http://localhost:8633
echo 前端界面: http://localhost:3456
echo.
echo 关闭此窗口不会停止服务
echo 请关闭对应的服务窗口来停止服务
echo.
pause

