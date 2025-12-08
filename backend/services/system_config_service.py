"""
系统配置服务
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
from models.system_config import SystemConfig
from schemas.system_config import SystemConfigCreate, SystemConfigUpdate


class SystemConfigService:
    """系统配置服务类"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_config(self, key: str) -> Optional[SystemConfig]:
        """获取配置"""
        result = await self.db.execute(
            select(SystemConfig).where(SystemConfig.key == key)
        )
        return result.scalar_one_or_none()
    
    async def get_config_value(self, key: str, default: Optional[str] = None) -> Optional[str]:
        """获取配置值"""
        config = await self.get_config(key)
        return config.value if config else default
    
    async def set_config(self, key: str, value: Optional[str], description: Optional[str] = None) -> SystemConfig:
        """设置配置（如果不存在则创建，存在则更新）"""
        config = await self.get_config(key)
        
        if config:
            # 更新现有配置
            if value is not None:
                config.value = value
            if description is not None:
                config.description = description
        else:
            # 创建新配置
            config = SystemConfig(
                key=key,
                value=value,
                description=description
            )
            self.db.add(config)
        
        await self.db.commit()
        await self.db.refresh(config)
        return config
    
    async def create_config(self, config_data: SystemConfigCreate) -> SystemConfig:
        """创建配置"""
        config = SystemConfig(
            key=config_data.key,
            value=config_data.value,
            description=config_data.description
        )
        self.db.add(config)
        await self.db.commit()
        await self.db.refresh(config)
        return config
    
    async def update_config(self, key: str, config_data: SystemConfigUpdate) -> Optional[SystemConfig]:
        """更新配置"""
        config = await self.get_config(key)
        if not config:
            return None
        
        if config_data.value is not None:
            config.value = config_data.value
        if config_data.description is not None:
            config.description = config_data.description
        
        await self.db.commit()
        await self.db.refresh(config)
        return config
    
    async def delete_config(self, key: str) -> bool:
        """删除配置"""
        config = await self.get_config(key)
        if not config:
            return False
        
        await self.db.delete(config)
        await self.db.commit()
        return True
    
    async def get_all_configs(self) -> List[SystemConfig]:
        """获取所有配置"""
        result = await self.db.execute(select(SystemConfig))
        return list(result.scalars().all())

