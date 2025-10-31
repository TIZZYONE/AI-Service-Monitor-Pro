"""
日志管理API路由
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from core.database import get_db
from services.log_service import LogService
from services.task_service import TaskService
from schemas.log import TaskLogResponse, LogContentResponse, TaskLogListResponse

router = APIRouter()


@router.get("/running")
async def get_running_tasks_logs(
    db: AsyncSession = Depends(get_db)
):
    """获取所有正在运行任务的最新日志内容"""
    task_service = TaskService(db)
    running_tasks = await task_service.get_running_tasks()
    
    log_service = LogService(db)
    result = {}
    
    for task in running_tasks:
        logs = await log_service.get_task_logs(task.id)
        if logs:
            # 获取最新日志的内容
            latest_log = logs[0]
            try:
                content, total_lines = await log_service.get_log_content(latest_log.log_file_path, 1000)
                result[task.id] = {
                    "content": content,
                    "total_lines": total_lines,
                    "file_path": latest_log.log_file_path
                }
            except Exception:
                result[task.id] = {
                    "content": "无法读取日志内容",
                    "total_lines": 0,
                    "file_path": latest_log.log_file_path
                }
    
    return {"data": result}


@router.get("/running/all", response_model=List[TaskLogResponse])
async def get_all_running_task_logs(
    db: AsyncSession = Depends(get_db)
):
    """获取所有正在运行任务的最新日志"""
    task_service = TaskService(db)
    running_tasks = await task_service.get_running_tasks()
    
    log_service = LogService(db)
    all_logs = []
    
    for task in running_tasks:
        logs = await log_service.get_task_logs(task.id)
        if logs:
            # 只取最新的日志
            all_logs.append(logs[0])
    
    return all_logs


@router.get("/{task_id}", response_model=TaskLogListResponse)
async def get_task_logs(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """获取指定任务的所有日志"""
    # 先检查任务是否存在
    task_service = TaskService(db)
    task = await task_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    log_service = LogService(db)
    logs = await log_service.get_task_logs(task_id)
    
    return TaskLogListResponse(logs=logs, total=len(logs))


@router.get("/{task_id}/content", response_model=LogContentResponse)
async def get_log_content(
    task_id: int,
    log_file_path: str = Query(..., description="日志文件路径"),
    max_lines: int = Query(10000, description="最大行数"),
    db: AsyncSession = Depends(get_db)
):
    """获取日志文件内容"""
    # 先检查任务是否存在
    task_service = TaskService(db)
    task = await task_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    log_service = LogService(db)
    content, total_lines = await log_service.get_log_content(log_file_path, max_lines)
    
    return LogContentResponse(
        content=content,
        total_lines=total_lines,
        file_path=log_file_path
    )


@router.get("/{task_id}/latest", response_model=LogContentResponse)
async def get_latest_log_content(
    task_id: int,
    max_lines: int = Query(10000, description="最大行数"),
    db: AsyncSession = Depends(get_db)
):
    """获取任务最新的日志内容"""
    # 先检查任务是否存在
    task_service = TaskService(db)
    task = await task_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    log_service = LogService(db)
    logs = await log_service.get_task_logs(task_id)
    
    if not logs:
        return LogContentResponse(
            content="暂无日志",
            total_lines=0,
            file_path=""
        )
    
    # 获取最新的日志文件
    latest_log = logs[0]
    content, total_lines = await log_service.get_log_content(latest_log.log_file_path, max_lines)
    
    return LogContentResponse(
        content=content,
        total_lines=total_lines,
        file_path=latest_log.log_file_path
    )


@router.delete("/{task_id}/cleanup")
async def cleanup_old_logs(
    task_id: int,
    max_files: int = Query(7, description="保留的最大文件数"),
    db: AsyncSession = Depends(get_db)
):
    """清理旧的日志文件"""
    # 先检查任务是否存在
    task_service = TaskService(db)
    task = await task_service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    log_service = LogService(db)
    await log_service.cleanup_old_logs(task_id, max_files)
    
    return {"message": f"已清理任务 {task_id} 的旧日志文件"}