@echo off
REM Windows 后端启动脚本（生产环境）
REM 使用方法：将此脚本添加到任务计划程序

REM 获取脚本所在目录并切换到backend目录
cd /d "%~dp0"
cd ..\..\backend

REM 激活conda环境（如果使用conda，取消下面的注释并修改环境名）
REM call conda activate your_env_name

REM 或者使用python虚拟环境（如果使用，取消下面的注释）
REM call venv\Scripts\activate.bat

REM 启动后端服务（生产环境）
python -m uvicorn main:app --host 0.0.0.0 --port 8633

