# Windows Frontend Auto-Start Configuration Script
# Usage: Run PowerShell as Administrator, execute: .\setup_auto_start_frontend.ps1
# Encoding: UTF-8

# Set console encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

Write-Host "========================================" -ForegroundColor Green
Write-Host "  AI Service Monitor Pro" -ForegroundColor Green
Write-Host "  Frontend Auto-Start Configuration" -ForegroundColor Green
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
$FrontendDir = Join-Path $ProjectDir "frontend"

# Check if frontend directory exists
if (-not (Test-Path $FrontendDir)) {
    Write-Host "ERROR: Frontend directory not found" -ForegroundColor Red
    pause
    exit 1
}

# Check if start_frontend.bat exists
$FrontendStartScript = Join-Path $ProjectDir "scripts\prod\start_frontend.bat"
if (-not (Test-Path $FrontendStartScript)) {
    Write-Host "ERROR: Frontend start script not found: $FrontendStartScript" -ForegroundColor Red
    pause
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Blue
Write-Host "  Project: $ProjectDir" -ForegroundColor Green
Write-Host "  Frontend: $FrontendDir" -ForegroundColor Green
Write-Host "  Frontend Script: $FrontendStartScript" -ForegroundColor Green
Write-Host ""

# Check Node.js installation
try {
    $nodeVersion = node --version 2>&1
    Write-Host "Node.js detected: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Node.js not found, install Node.js 16+" -ForegroundColor Red
    pause
    exit 1
}

# Check npm installation
try {
    $npmVersion = npm --version 2>&1
    Write-Host "npm detected: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: npm not found, install npm" -ForegroundColor Red
    pause
    exit 1
}

Write-Host ""

# Task name
$TaskName = "AI Service Monitor Pro - Frontend"

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
$Action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$FrontendStartScript`"" -WorkingDirectory $FrontendDir

# Create task trigger (startup)
$Trigger = New-ScheduledTaskTrigger -AtStartup

# Create task principal (run with highest privileges, regardless of user login)
$Principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

# Create task settings
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Create task description
$Description = "AI Service Monitor Pro - Frontend Service"

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
$response = Read-Host "Start frontend service now? (y/n)"
if ($response -eq "y" -or $response -eq "Y") {
    Write-Host "Starting frontend service..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName
    
    Start-Sleep -Seconds 3
    
    $taskInfo = Get-ScheduledTaskInfo -TaskName $TaskName
    if ($taskInfo.LastTaskResult -eq 0) {
        Write-Host "Frontend service started successfully!" -ForegroundColor Green
    } else {
        Write-Host "Frontend service may have failed, check Task Scheduler" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Configuration Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Common Commands:" -ForegroundColor Blue
Write-Host "  Start frontend: Start-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  Stop frontend: Stop-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  View task: Get-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host "  Delete task: Unregister-ScheduledTask -TaskName '$TaskName'" -ForegroundColor Green
Write-Host ""
Write-Host "You can also manage tasks in Task Scheduler" -ForegroundColor Yellow
Write-Host ""

pause

