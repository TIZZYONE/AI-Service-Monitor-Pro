"""
系统配置数据模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from core.database import Base


class SystemConfig(Base):
    """系统配置模型"""
    __tablename__ = "system_configs"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(255), unique=True, nullable=False, index=True, comment="配置键")
    value = Column(Text, nullable=True, comment="配置值")
    description = Column(Text, nullable=True, comment="配置描述")
    created_at = Column(DateTime, default=datetime.utcnow, comment="创建时间")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, comment="更新时间")
    
    def __repr__(self):
        return f"<SystemConfig(id={self.id}, key='{self.key}', value='{self.value}')>"

