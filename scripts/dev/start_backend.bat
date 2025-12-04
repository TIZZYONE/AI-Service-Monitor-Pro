@echo off
REM 后端启动脚本（开发环境 - Windows）
REM 使用方法: 双击运行或在命令行执行

chcp 65001 >nul
echo ========================================
echo   启动后端服务
echo ========================================
echo.

REM 获取脚本所在目录
cd /d "%~dp0"
cd ..\..\backend

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

REM 检查后端依赖
if exist "requirements.txt" (
    echo [检查] 后端依赖...
    python -c "import uvicorn" >nul 2>&1
    if errorlevel 1 (
        echo [安装] 后端依赖未安装，正在安装...
        pip install -r requirements.txt
    )
)

echo.
echo [启动] 后端服务 (端口 8633)...
echo 按 Ctrl+C 停止服务
echo.

python -m uvicorn main:app --host 0.0.0.0 --port 8633

pause

