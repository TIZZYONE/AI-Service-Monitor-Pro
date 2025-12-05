# Windows 前端开机自动启动配置脚本
# 使用方法: 以管理员身份运行 PowerShell，执行: .\setup_auto_start_frontend.ps1
# 编码: UTF-8

# 1设置控制台编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Green
Write-Host "  AI Service Monitor Pro" -ForegroundColor Green
Write-Host "  前端开机自动启动配置脚本" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# 检查管理员权限
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "错误: 请以管理员身份运行此脚本" -ForegroundColor Red
    Write-Host "右键点击 PowerShell，选择'以管理员身份运行'" -ForegroundColor Yellow
    pause
    exit 1
}

# 获取脚本所在目录
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$FrontendDir = Join-Path $ProjectDir "frontend"

# 检查frontend目录是否存在
if (-not (Test-Path $FrontendDir)) {
    Write-Host "错误: 未找到 frontend 目录" -ForegroundColor Red
    pause
    exit 1
}

# 检查start_frontend.bat是否存在
$FrontendStartScript = Join-Path $ProjectDir "scripts\prod\start_frontend.bat"
if (-not (Test-Path $FrontendStartScript)) {
    Write-Host "错误: 未找到前端启动脚本: $FrontendStartScript" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "当前配置信息:" -ForegroundColor Blue
Write-Host "  项目目录: $ProjectDir" -ForegroundColor Green
Write-Host "  前端目录: $FrontendDir" -ForegroundColor Green
Write-Host "  前端启动脚本: $FrontendStartScript" -ForegroundColor Green
Write-Host ""

# 检查Node.js是否安装
try {
    $nodeVersion = node --version 2>&1
    Write-Host "检测到 Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Node.js，请先安装 Node.js 16+" -ForegroundColor Red
    pause
    exit 1
}

# 检查npm是否安装
try {
    $npmVersion = npm --version 2>&1
    Write-Host "检测到 npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 npm，请先安装 npm" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""

# 任务名称
$TaskName = "AI Service Monitor Pro - Frontend"

# 检查任务是否已存在
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "检测到已存在的任务: $TaskName" -ForegroundColor Yellow
    $response = Read-Host "是否删除现有任务并重新创建? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "已删除现有任务" -ForegroundColor Green
    } else {
        Write-Host "已取消操作" -ForegroundColor Yellow
        pause
        exit 0
    }
}

# 创建任务操作
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$FrontendStartScript`"" -WorkingDirectory $FrontendDir

# 创建任务触发器（开机启动）
$Trigger = New-ScheduledTaskTrigger -AtStartup

# 创建任务主体（以最高权限运行，不管用户是否登录）
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

# 创建任务设置
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# 创建任务描述
$Description = "AI Service Monitor Pro - 前端服务"

# 注册任务
Write-Host "正在创建计划任务..." -ForegroundColor Yellow
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description $Description | Out-Null
    Write-Host "任务创建成功!" -ForegroundColor Green
} catch {
    Write-Host "错误: 创建任务失败: $_" -ForegroundColor Red
    pause
    exit 1
}

# 询问是否立即运行任务
Write-Host ""
$response = Read-Host "是否立即启动前端服务? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "正在启动前端服务..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    
    Start-Sleep -Seconds 3
    
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    if ($taskInfo.LastTaskResult -eq 0) {
        Write-Host "前端服务启动成功!" -ForegroundColor Green
    } else {
        Write-Host "前端服务可能启动失败，请检查任务计划程序" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  配置完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "常用操作:" -ForegroundColor Blue
Write-Host "  启动前端: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  停止前端: Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  查看任务: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  删除任务: Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host ""
Write-Host "也可以在任务计划程序中管理此任务" -ForegroundColor Yellow
Write-Host ""

pause

