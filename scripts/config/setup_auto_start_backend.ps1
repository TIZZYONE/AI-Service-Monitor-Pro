# Windows Backend Auto-Start Configuration Script
# Usage: Run PowerShell as Administrator, execute: .\setup_auto_start_backend.ps1
# Encoding: UTF-8

# Set console encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Green
Write-Host "  AI Service Monitor Pro" -ForegroundColor Green
Write-Host "  Backend Auto-Start Configuration" -ForegroundColor Green
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

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$BackendDir = Join-Path $ProjectDir "backend"

# Check if backend directory exists
if (-not (Test-Path $BackendDir)) {
    Write-Host "ERROR: Backend directory not found" -ForegroundColor Red
    pause
    exit 1
}

# Check if start_backend.bat exists
$BackendStartScript = Join-Path $ProjectDir "scripts\prod\start_backend.bat"
if (-not (Test-Path $BackendStartScript)) {
    Write-Host "ERROR: Backend start script not found: $BackendStartScript" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Blue
Write-Host "  Project: $ProjectDir" -ForegroundColor Green
Write-Host "  Backend: $BackendDir" -ForegroundColor Green
Write-Host "  Backend Script: $BackendStartScript" -ForegroundColor Green
Write-Host ""

# Check Python installation
try {
    $pythonVersion = python --version 2>&1
    Write-Host "Python detected: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Python not found, install Python 3.8+" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""

# Task name
$TaskName = "AI Service Monitor Pro - Backend"

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Task exists: $TaskName" -ForegroundColor Yellow
    $response = Read-Host "Delete and recreate? (y/n)"
    if ($response -eq "y" -or $response -eq "Y") {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "Existing task deleted" -ForegroundColor Green
    } else {
        Write-Host "Operation cancelled" -ForegroundColor Yellow
        pause
        exit 0
    }
}

# Create task action
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$BackendStartScript`"" -WorkingDirectory $BackendDir

# Create task trigger (startup)
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Create task principal (run with highest privileges, regardless of user login)
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

# Create task settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Create task description
$Description = "AI Service Monitor Pro - Backend Service"

# Register task
Write-Host "Creating scheduled task..." -ForegroundColor Yellow
try {
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Principal $Principal -Settings $Settings -Description $Description | Out-Null
    Write-Host "Task created successfully!" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to create task: $_" -ForegroundColor Red
    pause
    exit 1
}

# Ask to start now
Write-Host ""
$response = Read-Host "Start backend service now? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "Starting backend service..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    
    Start-Sleep -Seconds 3
    
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    if ($taskInfo.LastTaskResult -eq 0) {
        Write-Host "Backend service started successfully!" -ForegroundColor Green
    } else {
        Write-Host "Backend service may have failed, check Task Scheduler" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Common Commands:" -ForegroundColor Blue
Write-Host "  Start backend: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  Stop backend: Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  View task: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  Delete task: Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host ""
Write-Host "You can also manage tasks in Task Scheduler" -ForegroundColor Yellow
Write-Host ""

pause

