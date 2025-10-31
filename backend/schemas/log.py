"""
日志相关的Pydantic模式
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class TaskLogResponse(BaseModel):
    """任务日志响应模式"""
    id: int
    task_id: int
    log_file_path: str
    start_time: datetime
    end_time: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class LogContentResponse(BaseModel):
    """日志内容响应模式"""
    content: str
    total_lines: int
    file_path: str


class TaskLogListResponse(BaseModel):
    """任务日志列表响应模式"""
    logs: list[TaskLogResponse]
    total: int