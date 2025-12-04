"""
任务管理相关的API路由
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from core.database import get_db
from services.task_service import TaskService
from schemas.task import TaskCreate, TaskUpdate, TaskResponse, TaskListResponse
from models.task import TaskStatus

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_data: TaskCreate,
    db: AsyncSession = Depends(get_db)
):
    """创建新任务"""
    service = TaskService(db)
    task = await service.create_task(task_data)
    # 创建后立即接入调度器进行调度/重调度
    from main import app
    await app.state.scheduler.reschedule_task(task.id)
    return task


@router.get("/", response_model=TaskListResponse)
async def get_tasks(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """获取任务列表"""
    service = TaskService(db)
    tasks = await service.get_tasks(skip=skip, limit=limit)
    total = await service.get_tasks_count()
    
    return TaskListResponse(tasks=tasks, total=total)


@router.get("/running", response_model=List[TaskResponse])
async def get_running_tasks(
    db: AsyncSession = Depends(get_db)
):
    """获取运行中的任务"""
    service = TaskService(db)
    tasks = await service.get_running_tasks()
    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """根据ID获取任务"""
    service = TaskService(db)
    task = await service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    return task


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新任务"""
    service = TaskService(db)
    
    # 获取当前任务状态
    current_task = await service.get_task(task_id)
    if not current_task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    # 如果任务状态是失败、完成或停止，且用户没有明确设置状态，则重置为等待中
    if (current_task.status in [TaskStatus.FAILED, TaskStatus.COMPLETED, TaskStatus.STOPPED] 
        and task_data.status is None):
        task_data.status = TaskStatus.PENDING
        logger.info(f"任务 {task_id} 状态从 {current_task.status} 重置为 PENDING")
    
    task = await service.update_task(task_id, task_data)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    # 更新后重调度，确保最新设置生效
    from main import app
    await app.state.scheduler.reschedule_task(task_id)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """删除任务"""
    service = TaskService(db)
    success = await service.delete_task(task_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )


@router.post("/{task_id}/start", response_model=TaskResponse)
async def start_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """手动启动任务"""
    logger.info(f"API: 收到启动任务请求，任务ID: {task_id}")
    from main import app
    
    service = TaskService(db)
    task = await service.get_task(task_id)
    
    if not task:
        logger.warning(f"API: 任务 {task_id} 不存在")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    logger.info(f"API: 任务 {task_id} 当前状态: {task.status}")
    
    if task.status == TaskStatus.RUNNING:
        logger.info(f"API: 任务 {task_id} 已在运行中")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="任务已在运行中"
        )
    
    # 通过调度器启动任务
    logger.info(f"API: 调用调度器启动任务 {task_id}")
    scheduler = app.state.scheduler
    success = await scheduler.start_task_immediately(task_id)
    
    logger.info(f"API: 调度器启动任务 {task_id} 结果: {success}")
    
    if not success:
        logger.error(f"API: 启动任务 {task_id} 失败")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="启动任务失败"
        )
    
    # 返回更新后的任务状态
    updated_task = await service.get_task(task_id)
    logger.info(f"API: 任务 {task_id} 启动后状态: {updated_task.status}")
    return updated_task


@router.post("/{task_id}/stop", response_model=TaskResponse)
async def stop_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """手动停止任务"""
    from main import app
    
    service = TaskService(db)
    task = await service.get_task(task_id)
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="任务不存在"
        )
    
    if task.status != TaskStatus.RUNNING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="任务未在运行中"
        )
    
    # 通过调度器停止任务
    scheduler = app.state.scheduler
    success = await scheduler.stop_task(task_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="停止任务失败"
        )
    
    # 返回更新后的任务状态
    updated_task = await service.get_task(task_id)
    return updated_task


@router.post("/stop-all", status_code=status.HTTP_200_OK)
async def stop_all_tasks(
    db: AsyncSession = Depends(get_db)
):
    """停止所有正在运行的任务"""
    from main import app
    
    scheduler = app.state.scheduler
    result = await scheduler.stop_all_tasks()
    
    return result