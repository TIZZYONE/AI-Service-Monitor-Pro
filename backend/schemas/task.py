"""
任务相关的Pydantic模式
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional
from models.task import RepeatType, TaskStatus


class TaskCreate(BaseModel):
    """创建任务的请求模式"""
    name: str = Field(..., description="任务名称", max_length=255)
    activate_env_command: str = Field(..., description="激活环境命令")
    main_program_command: str = Field(..., description="主程序命令")
    repeat_type: RepeatType = Field(default=RepeatType.NONE, description="重复类型")
    start_time: datetime = Field(..., description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")


class TaskUpdate(BaseModel):
    """更新任务的请求模式"""
    name: Optional[str] = Field(None, description="任务名称", max_length=255)
    activate_env_command: Optional[str] = Field(None, description="激活环境命令")
    main_program_command: Optional[str] = Field(None, description="主程序命令")
    repeat_type: Optional[RepeatType] = Field(None, description="重复类型")
    start_time: Optional[datetime] = Field(None, description="开始时间")
    end_time: Optional[datetime] = Field(None, description="结束时间")
    status: Optional[TaskStatus] = Field(None, description="任务状态")


class TaskResponse(BaseModel):
    """任务响应模式"""
    id: int
    name: str
    activate_env_command: str
    main_program_command: str
    repeat_type: RepeatType
    start_time: datetime
    end_time: Optional[datetime]
    status: TaskStatus
    process_id: Optional[int]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaskListResponse(BaseModel):
    """任务列表响应模式"""
    tasks: list[TaskResponse]
    total: int