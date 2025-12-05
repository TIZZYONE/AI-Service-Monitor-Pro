# Windows Auto-Start Configuration Script (Backend + Frontend)
# Usage: Run PowerShell as Administrator, execute: .\setup_auto_start_windows.ps1
# Encoding: UTF-8

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Green
Write-Host "  AI Service Monitor Pro" -ForegroundColor Green
Write-Host "  Auto-Start Configuration" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Check admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERROR: Please run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell, select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

# Get directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BackendDir = Join-Path $ProjectDir "backend"
$FrontendDir = Join-Path $ProjectDir "frontend"

# Check backend
if (-not (Test-Path $BackendDir)) {
    Write-Host "ERROR: Backend directory not found" -ForegroundColor Red
    pause
    exit 1
}

$BackendStartScript = Join-Path $ProjectDir "scripts\prod\start_backend.bat"
if (-not (Test-Path $BackendStartScript)) {
    Write-Host "ERROR: Backend start script not found: $BackendStartScript" -ForegroundColor Red
    pause
    exit 1
}

# Check frontend
$FrontendStartScript = Join-Path $ProjectDir "scripts\prod\start_frontend.bat"
$hasFrontend = Test-Path $FrontendStartScript

Write-Host "Configuration:" -ForegroundColor Blue
Write-Host "  Project: $ProjectDir" -ForegroundColor Green
Write-Host "  Backend: $BackendDir" -ForegroundColor Green
Write-Host "  Backend Script: $BackendStartScript" -ForegroundColor Green
if ($hasFrontend) {
    Write-Host "  Frontend: $FrontendDir" -ForegroundColor Green
    Write-Host "  Frontend Script: $FrontendStartScript" -ForegroundColor Green
}
Write-Host ""

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python detected: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found, install Python 3.8+" -ForegroundColor Red
    pause
    exit 1
}

# Check Node.js
try {
    $nodeVersion = node --version 2>&1
    Write-Host "Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Node.js not found (needed for frontend)" -ForegroundColor Yellow
}

Write-Host ""

# Ask about frontend
$configureFrontend = $false
if ($hasFrontend) {
    Write-Host "Configure frontend auto-start? (y/n)" -ForegroundColor Yellow
    $response = Read-Host "Default: y"
    if ($response -eq "" -or $response -eq "y" -or $response -eq "Y") {
        $configureFrontend = $true
    }
}
Write-Host ""

# Configure backend task
$BackendTaskName = "AI Service Monitor Pro - Backend"

$existingBackendTask = Get-ScheduledTask -TaskName $BackendTaskName -ErrorAction SilentlyContinue
if ($existingBackendTask) {
    Write-Host "Backend task exists: $BackendTaskName" -ForegroundColor Yellow
    $response = Read-Host "Delete and recreate? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Unregister-ScheduledTask -TaskName $BackendTaskName -Confirm:$false
        Write-Host "Existing backend task deleted" -ForegroundColor Green
    }
}

# Create backend task
$BackendAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BackendStartScript`"" -WorkingDirectory $BackendDir
$Trigger = New-ScheduledTaskTrigger -AtStartup
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Write-Host "Creating backend task..." -ForegroundColor Yellow
try {
    Register-ScheduledTask -TaskName $BackendTaskName -Action $BackendAction -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "AI Service Monitor Pro - Backend Service" | Out-Null
    Write-Host "Backend task created!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create backend task: $_" -ForegroundColor Red
    pause
    exit 1
}

# Configure frontend task
if ($configureFrontend) {
    $FrontendTaskName = "AI Service Monitor Pro - Frontend"

    $existingFrontendTask = Get-ScheduledTask -TaskName $FrontendTaskName -ErrorAction SilentlyContinue
    if ($existingFrontendTask) {
        Write-Host "Frontend task exists: $FrontendTaskName" -ForegroundColor Yellow
        $response = Read-Host "Delete and recreate? (y/n)"
        if ($response -eq "y" -or $response -eq "Y") {
            Unregister-ScheduledTask -TaskName $FrontendTaskName -Confirm:$false
            Write-Host "Existing frontend task deleted" -ForegroundColor Green
        }
    }

    $FrontendAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$FrontendStartScript`"" -WorkingDirectory $FrontendDir

    Write-Host "Creating frontend task..." -ForegroundColor Yellow
    try {
        Register-ScheduledTask -TaskName $FrontendTaskName -Action $FrontendAction -Trigger $Trigger -Principal $Principal -Settings $Settings -Description "AI Service Monitor Pro - Frontend Service" | Out-Null
        Write-Host "Frontend task created!" -ForegroundColor Green
    } catch {
        Write-Host "ERROR: Failed to create frontend task: $_" -ForegroundColor Red
    }
}

# Ask to start now
Write-Host ""
$response = Read-Host "Start services now? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "Starting backend..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $BackendTaskName

    if ($configureFrontend) {
        Start-Sleep -Seconds 2
        Write-Host "Starting frontend..." -ForegroundColor Yellow
        Start-ScheduledTask -TaskName $FrontendTaskName
    }

    Start-Sleep -Seconds 3

    $backendTaskInfo = Get-ScheduledTaskInfo -TaskName $BackendTaskName
    if ($backendTaskInfo.LastTaskResult -eq 0) {
        Write-Host "Backend started successfully!" -ForegroundColor Green
    } else {
        Write-Host "Backend may have failed, check Task Scheduler" -ForegroundColor Yellow
    }

    if ($configureFrontend) {
        $frontendTaskInfo = Get-ScheduledTaskInfo -TaskName $FrontendTaskName
        if ($frontendTaskInfo.LastTaskResult -eq 0) {
            Write-Host "Frontend started successfully!" -ForegroundColor Green
        } else {
            Write-Host "Frontend may have failed, check Task Scheduler" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Common Commands:" -ForegroundColor Blue
Write-Host "  Start backend: Start-ScheduledTask -TaskName '$BackendTaskName'" -ForegroundColor Green
Write-Host "  Stop backend: Stop-ScheduledTask -TaskName '$BackendTaskName'" -ForegroundColor Green
if ($configureFrontend) {
    Write-Host "  Start frontend: Start-ScheduledTask -TaskName '$FrontendTaskName'" -ForegroundColor Green
    Write-Host "  Stop frontend: Stop-ScheduledTask -TaskName '$FrontendTaskName'" -ForegroundColor Green
}
Write-Host "  View tasks: Get-ScheduledTask -TaskName '*AI Service Monitor*'" -ForegroundColor Green
Write-Host ""
Write-Host "You can also manage tasks in Task Scheduler" -ForegroundColor Yellow
Write-Host ""

pause