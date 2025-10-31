"""
任务服务层
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime

from models.task import Task, TaskStatus
from schemas.task import TaskCreate, TaskUpdate


class TaskService:
    """任务服务类"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_task(self, task_data: TaskCreate) -> Task:
        """创建任务"""
        task = Task(
            name=task_data.name,
            activate_env_command=task_data.activate_env_command,
            main_program_command=task_data.main_program_command,
            repeat_type=task_data.repeat_type,
            start_time=task_data.start_time,
            end_time=task_data.end_time,
            status=TaskStatus.PENDING
        )
        
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task
    
    async def get_task(self, task_id: int) -> Optional[Task]:
        """根据ID获取任务"""
        result = await self.db.execute(
            select(Task).where(Task.id == task_id)
        )
        return result.scalar_one_or_none()
    
    async def get_tasks(self, skip: int = 0, limit: int = 100) -> List[Task]:
        """获取任务列表"""
        result = await self.db.execute(
            select(Task).offset(skip).limit(limit).order_by(Task.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_tasks_count(self) -> int:
        """获取任务总数"""
        result = await self.db.execute(
            select(func.count(Task.id))
        )
        return result.scalar()
    
    async def update_task(self, task_id: int, task_data: TaskUpdate) -> Optional[Task]:
        """更新任务"""
        # 获取现有任务
        task = await self.get_task(task_id)
        if not task:
            return None
        
        # 更新字段
        update_data = task_data.model_dump(exclude_unset=True)
        if update_data:
            update_data['updated_at'] = datetime.utcnow()
            
            await self.db.execute(
                update(Task).where(Task.id == task_id).values(**update_data)
            )
            await self.db.commit()
            
            # 重新获取更新后的任务
            task = await self.get_task(task_id)
        
        return task
    
    async def delete_task(self, task_id: int) -> bool:
        """删除任务"""
        task = await self.get_task(task_id)
        if not task:
            return False
        
        await self.db.execute(
            delete(Task).where(Task.id == task_id)
        )
        await self.db.commit()
        return True
    
    async def get_running_tasks(self) -> List[Task]:
        """获取正在运行的任务"""
        result = await self.db.execute(
            select(Task).where(Task.status == TaskStatus.RUNNING)
        )
        return result.scalars().all()
    
    async def get_pending_tasks(self) -> List[Task]:
        """获取等待中的任务"""
        result = await self.db.execute(
            select(Task).where(Task.status == TaskStatus.PENDING)
        )
        return result.scalars().all()
    
    async def update_task_status(self, task_id: int, status: TaskStatus, process_id: Optional[int] = None) -> bool:
        """更新任务状态"""
        update_data = {
            'status': status,
            'updated_at': datetime.utcnow()
        }
        
        if process_id is not None:
            update_data['process_id'] = process_id
        
        result = await self.db.execute(
            update(Task).where(Task.id == task_id).values(**update_data)
        )
        await self.db.commit()
        
        return result.rowcount > 0