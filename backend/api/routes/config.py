"""
系统配置相关的API路由
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from core.database import get_db
from services.system_config_service import SystemConfigService
from schemas.system_config import SystemConfigCreate, SystemConfigUpdate, SystemConfigResponse

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/{key}", response_model=SystemConfigResponse)
async def get_config(
    key: str,
    db: AsyncSession = Depends(get_db)
):
    """获取指定配置"""
    service = SystemConfigService(db)
    config = await service.get_config(key)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"配置 '{key}' 不存在"
        )
    return config


@router.get("/", response_model=List[SystemConfigResponse])
async def get_all_configs(
    db: AsyncSession = Depends(get_db)
):
    """获取所有配置"""
    service = SystemConfigService(db)
    configs = await service.get_all_configs()
    return configs


@router.post("/", response_model=SystemConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_config(
    config_data: SystemConfigCreate,
    db: AsyncSession = Depends(get_db)
):
    """创建配置"""
    service = SystemConfigService(db)
    # 检查是否已存在
    existing = await service.get_config(config_data.key)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"配置 '{config_data.key}' 已存在，请使用 PUT 方法更新"
        )
    return await service.create_config(config_data)


@router.put("/{key}", response_model=SystemConfigResponse)
async def update_config(
    key: str,
    config_data: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db)
):
    """更新配置"""
    service = SystemConfigService(db)
    config = await service.update_config(key, config_data)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"配置 '{key}' 不存在"
        )
    return config


@router.put("/{key}/value", response_model=SystemConfigResponse)
async def set_config_value(
    key: str,
    body: dict = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """设置配置值（如果不存在则创建，存在则更新）"""
    service = SystemConfigService(db)
    value = body.get('value')
    description = body.get('description')
    return await service.set_config(key, value, description)


@router.delete("/{key}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(
    key: str,
    db: AsyncSession = Depends(get_db)
):
    """删除配置"""
    service = SystemConfigService(db)
    success = await service.delete_config(key)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"配置 '{key}' 不存在"
        )

