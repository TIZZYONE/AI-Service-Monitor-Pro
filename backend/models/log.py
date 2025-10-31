"""
日志数据模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
from core.database import Base


class TaskLog(Base):
    """任务日志模型"""
    __tablename__ = "task_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False, comment="任务ID")
    log_file_path = Column(String(500), nullable=False, comment="日志文件路径")
    start_time = Column(DateTime, nullable=False, comment="日志开始时间")
    end_time = Column(DateTime, nullable=True, comment="日志结束时间")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    
    def __repr__(self):
        return f"<TaskLog(id={self.id}, task_id={self.task_id}, log_file='{self.log_file_path}')>"