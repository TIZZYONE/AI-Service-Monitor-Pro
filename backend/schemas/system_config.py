"""
系统配置相关的Pydantic模式
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SystemConfigCreate(BaseModel):
    """创建系统配置"""
    key: str = Field(..., description="配置键")
    value: Optional[str] = Field(None, description="配置值")
    description: Optional[str] = Field(None, description="配置描述")


class SystemConfigUpdate(BaseModel):
    """更新系统配置"""
    value: Optional[str] = Field(None, description="配置值")
    description: Optional[str] = Field(None, description="配置描述")


class SystemConfigResponse(BaseModel):
    """系统配置响应"""
    id: int
    key: str
    value: Optional[str]
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

