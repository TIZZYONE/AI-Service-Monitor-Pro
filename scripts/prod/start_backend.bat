@echo off
REM Windows 后端启动脚本（生产环境）
REM 使用方法：将此脚本添加到任务计划程序

REM 获取脚本所在目录并切换到backend目录
cd /d "%~dp0"
cd ..\..\backend

REM 初始化conda（在任务计划程序中可能需要）
REM 如果conda命令不可用，请取消下面的注释并设置正确的conda路径
if not exist "%CONDA_EXE%" (
    REM 尝试常见的conda安装路径
    if exist "D:\ProgramData\anaconda3\Scripts\activate.bat" (
        call D:\ProgramData\anaconda3\Scripts\activate.bat
    ) else if exist "C:\ProgramData\anaconda3\Scripts\activate.bat" (
        call C:\ProgramData\anaconda3\Scripts\activate.bat
    ) else if exist "%USERPROFILE%\anaconda3\Scripts\activate.bat" (
        call "%USERPROFILE%\anaconda3\Scripts\activate.bat"
    )
)

REM 激活conda环境1
call conda activate AI-Service-Monitor-Pro

REM 或者使用python虚拟环境（如果使用，取消下面的注释）
REM call venv\Scripts\activate.bat

REM 启动后端服务（生产环境）
python -m uvicorn main:app --host 0.0.0.0 --port 8633

