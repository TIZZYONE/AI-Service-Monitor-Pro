# Windows 一键配置开机自动启动脚本（前后端一起配置）
# 使用方法: 以管理员身份运行 PowerShell，执行: .\setup_auto_start_windows.ps1
# 
# 注意: 如果需要单独配置，可以使用:
#   - setup_auto_start_backend.ps1   (只配置后端)
#   - setup_auto_start_frontend.ps1  (只配置前端)
# 编码: UTF-8

# 设置控制台编码为UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Green
Write-Host "  AI Service Monitor Pro" -ForegroundColor Green
Write-Host "  开机自动启动配置脚本" -ForegroundColor Green
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
$BackendDir = Join-Path $ProjectDir "backend"
$FrontendDir = Join-Path $ProjectDir "frontend"

# 检查backend目录是否存在
if (-not (Test-Path $BackendDir)) {
    Write-Host "错误: 未找到 backend 目录" -ForegroundColor Red
    pause
    exit 1
}

# 检查start_backend.bat是否存在
$BackendStartScript = Join-Path $ProjectDir "scripts\prod\start_backend.bat"
if (-not (Test-Path $BackendStartScript)) {
    Write-Host "错误: 未找到后端启动脚本: $BackendStartScript" -ForegroundColor Red
    pause
    exit 1
}

# 检查start_frontend.bat是否存在
$FrontendStartScript = Join-Path $ProjectDir "scripts\prod\start_frontend.bat"
$hasFrontend = Test-Path $FrontendStartScript

Write-Host "当前配置信息:" -ForegroundColor Blue
Write-Host "  项目目录: $ProjectDir" -ForegroundColor Green
Write-Host "  后端目录: $BackendDir" -ForegroundColor Green
Write-Host "  后端启动脚本: $BackendStartScript" -ForegroundColor Green
if ($hasFrontend) {
    Write-Host "  前端目录: $FrontendDir" -ForegroundColor Green
    Write-Host "  前端启动脚本: $FrontendStartScript" -ForegroundColor Green
}
Write-Host ""

# 检查Python是否安装
try {
    $pythonVersion = python --version 2>&1
    Write-Host "检测到 Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "错误: 未找到 Python，请先安装 Python 3.8+" -ForegroundColor Red
    pause
    exit 1
}

# 检查Node.js是否安装
try {
    $nodeVersion = node --version 2>&1
    Write-Host "检测到 Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "警告: 未找到 Node.js（前端需要）" -ForegroundColor Yellow
}

Write-Host ""

# 询问是否配置前端开机启动
$configureFrontend = $false
if ($hasFrontend) {
    Write-Host "是否同时配置前端开机启动? (y/n)" -ForegroundColor Yellow
    $response = Read-Host "默认: y"
    if ($response -eq "" -or $response -eq "y" -or $response -eq "Y") {
        $configureFrontend = $true
    }
}
Write-Host ""

# 配置后端任务
$BackendTaskName = "AI Service Monitor Pro - Backend"

# 检查后端任务是否已存在
$existingBackendTask = Get-ScheduledTask -TaskName $BackendTaskName -ErrorAction SilentlyContinue
if ($existingBackendTask) {
    Write-Host "检测到已存在的后端任务: $BackendTaskName" -ForegroundColor Yellow
    $response = Read-Host "是否删除现有任务并重新创建? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Unregister-ScheduledTask -TaskName $BackendTaskName -Confirm:$false
        Write-Host "已删除现有后端任务" -ForegroundColor Green
    }
}

# 创建后端任务操作
$BackendAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BackendStartScript`"" -WorkingDirectory $BackendDir

# 创建任务触发器（开机启动）
$Trigger = New-ScheduledTaskTrigger -AtStartup

# 创建任务主体（以最高权限运行，不管用户是否登录）
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

# 创建任务设置
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# 注册后端任务
Write-Host "正在创建后端计划任务..." -ForegroundColor Yellow
try {
    Register-ScheduledTask -TaskName $BackendTaskName -Action $BackendAction -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "AI Service Monitor Pro - 后端服务" | Out-Null
    Write-Host "后端任务创建成功!" -ForegroundColor Green
} catch {
    Write-Host "错误: 创建后端任务失败: $_" -ForegroundColor Red
    pause
    exit 1
}

# 配置前端任务
if ($configureFrontend) {
    $FrontendTaskName = "AI Service Monitor Pro - Frontend"
    
    # 检查前端任务是否已存在
    $existingFrontendTask = Get-ScheduledTask -TaskName $FrontendTaskName -ErrorAction SilentlyContinue
    if ($existingFrontendTask) {
        Write-Host "检测到已存在的前端任务: $FrontendTaskName" -ForegroundColor Yellow
        $response = Read-Host "是否删除现有任务并重新创建? (y/n)"
        if ($response -eq "y" -or $response -eq "Y") {
            Unregister-ScheduledTask -TaskName $FrontendTaskName -Confirm:$false
            Write-Host "已删除现有前端任务" -ForegroundColor Green
        }
    }
    
    # 创建前端任务操作
    $FrontendAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$FrontendStartScript`"" -WorkingDirectory $FrontendDir
    
    # 注册前端任务
    Write-Host "正在创建前端计划任务..." -ForegroundColor Yellow
    try {
        Register-ScheduledTask -TaskName $FrontendTaskName -Action $FrontendAction -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "AI Service Monitor Pro - 前端服务" | Out-Null
        Write-Host "前端任务创建成功!" -ForegroundColor Green
    } catch {
        Write-Host "错误: 创建前端任务失败: $_" -ForegroundColor Red
    }
}

# 询问是否立即运行任务
Write-Host ""
$response = Read-Host "是否立即启动服务? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "正在启动后端服务..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $BackendTaskName
    
    if ($configureFrontend) {
        Start-Sleep -Seconds 2
        Write-Host "正在启动前端服务..." -ForegroundColor Yellow
        Start-ScheduledTask -TaskName $FrontendTaskName
    }
    
    Start-Sleep -Seconds 3
    
    $backendTaskInfo = Get-ScheduledTaskInfo -TaskName $BackendTaskName
    if ($backendTaskInfo.LastTaskResult -eq 0) {
        Write-Host "后端服务启动成功!" -ForegroundColor Green
    } else {
        Write-Host "后端服务可能启动失败，请检查任务计划程序" -ForegroundColor Yellow
    }
    
    if ($configureFrontend) {
        $frontendTaskInfo = Get-ScheduledTaskInfo -TaskName $FrontendTaskName
        if ($frontendTaskInfo.LastTaskResult -eq 0) {
            Write-Host "前端服务启动成功!" -ForegroundColor Green
        } else {
            Write-Host "前端服务可能启动失败，请检查任务计划程序" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  配置完成！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "常用操作:" -ForegroundColor Blue
Write-Host "  启动后端: Start-ScheduledTask -TaskName '$BackendTaskName'" -ForegroundColor Green
Write-Host "  停止后端: Stop-ScheduledTask -TaskName '$BackendTaskName'" -ForegroundColor Green
if ($configureFrontend) {
    Write-Host "  启动前端: Start-ScheduledTask -TaskName '$FrontendTaskName'" -ForegroundColor Green
    Write-Host "  停止前端: Stop-ScheduledTask -TaskName '$FrontendTaskName'" -ForegroundColor Green
}
Write-Host "  查看任务: Get-ScheduledTask -TaskName '*AI Service Monitor*'" -ForegroundColor Green
Write-Host ""
Write-Host "也可以在任务计划程序中管理这些任务" -ForegroundColor Yellow
Write-Host ""

pause

