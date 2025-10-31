"""
任务数据模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, Enum
from datetime import datetime
import enum
from core.database import Base


class RepeatType(enum.Enum):
    """重复类型枚举"""
    NONE = "none"  # 不重复
    DAILY = "daily"  # 每日重复
    WEEKLY = "weekly"  # 每周重复
    MONTHLY = "monthly"  # 每月重复
    QUARTERLY = "quarterly"  # 每季度重复


class TaskStatus(enum.Enum):
    """任务状态枚举"""
    PENDING = "pending"  # 等待中
    RUNNING = "running"  # 运行中
    STOPPED = "stopped"  # 已停止
    COMPLETED = "completed"  # 已完成
    FAILED = "failed"  # 失败


class Task(Base):
    """任务模型"""
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, comment="任务名称")
    activate_env_command = Column(Text, nullable=False, comment="激活环境命令")
    main_program_command = Column(Text, nullable=False, comment="主程序命令")
    repeat_type = Column(Enum(RepeatType), default=RepeatType.NONE, comment="重复类型")
    start_time = Column(DateTime, nullable=False, comment="开始时间")
    end_time = Column(DateTime, nullable=True, comment="结束时间")
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, comment="任务状态")
    process_id = Column(Integer, nullable=True, comment="进程ID")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    def __repr__(self):
        return f"<Task(id={self.id}, name='{self.name}', status='{self.status}')>"