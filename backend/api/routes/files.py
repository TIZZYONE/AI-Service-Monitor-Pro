"""
文件管理相关的API路由
"""
import os
import platform
from pathlib import Path
from fastapi import APIRouter, HTTPException, status, Query, UploadFile, File, Form, Body
from fastapi.responses import FileResponse
from typing import List, Optional
from pydantic import BaseModel
import aiofiles

router = APIRouter()


class FileItem(BaseModel):
    """文件项模型"""
    name: str
    path: str
    is_directory: bool
    size: Optional[int] = None
    modified_time: Optional[float] = None


class DirectoryResponse(BaseModel):
    """目录响应模型"""
    current_path: str
    parent_path: Optional[str] = None
    items: List[FileItem]


class FileContentResponse(BaseModel):
    """文件内容响应模型"""
    content: str
    path: str
    encoding: str = "utf-8"


class FileSaveRequest(BaseModel):
    """文件保存请求模型"""
    content: str
    encoding: str = "utf-8"


def get_home_directory() -> str:
    """获取基础目录（Windows上返回根目录，其他系统返回用户主目录）"""
    if platform.system() == "Windows":
        # Windows上返回根目录（C:\），但允许访问所有盘符
        return os.path.splitdrive(os.path.expanduser("~"))[0] + "\\"
    else:
        # Linux/Mac上返回用户主目录
        return os.path.expanduser("~")


def is_safe_path(path: str, base_path: str) -> bool:
    """检查路径是否安全（防止路径遍历攻击）
    
    Windows上：允许访问所有盘符（C:\、D:\、E:\等），但防止路径遍历攻击
    其他系统：检查路径是否在基础路径内
    """
    try:
        if platform.system() == "Windows":
            # Windows上：检查是否是有效的盘符路径
            # 先规范化路径，统一使用反斜杠
            normalized_path = path.replace('/', '\\')
            
            # 检查路径格式：必须是 X:\ 或 X:\... 格式（X是盘符）
            import re
            # 匹配盘符路径：如 C:\、D:\、C:\Users 等
            drive_pattern = re.compile(r'^[A-Za-z]:\\')
            if not drive_pattern.match(normalized_path):
                return False
            
            # 使用 realpath 解析路径（这会处理 .. 和符号链接）
            try:
                resolved_path = os.path.realpath(path)
                resolved_path = resolved_path.replace('/', '\\')
                
                # 确保解析后的路径仍然是有效的盘符路径
                if not drive_pattern.match(resolved_path):
                    return False
                
                # 检查解析后的路径是否包含 ..（不应该有，因为 realpath 已经解析了）
                if '..' in resolved_path:
                    return False
                
                # Windows上允许访问所有盘符
                return True
            except (OSError, ValueError):
                # 如果路径无效（如不存在的路径），realpath 会抛出异常
                # 但我们仍然允许访问，让后续的代码处理错误
                return drive_pattern.match(normalized_path) is not None
        else:
            # Linux/Mac上检查路径是否在基础路径内
            resolved_path = os.path.realpath(path)
            resolved_base = os.path.realpath(base_path)
            return resolved_path.startswith(resolved_base)
    except Exception:
        return False


@router.get("/list", response_model=DirectoryResponse)
async def list_directory(
    path: Optional[str] = Query(None, description="目录路径，默认为根目录（Windows显示所有盘符）")
):
    """
    列出指定目录的内容
    
    Windows上：如果不指定路径，返回所有可用的盘符列表
    其他系统：如果不指定路径，返回用户主目录
    """
    try:
        # 如果没有指定路径或路径为空字符串
        if not path or path.strip() == "":
            if platform.system() == "Windows":
                # Windows上：返回所有可用的盘符
                import string
                available_drives = []
                for drive_letter in string.ascii_uppercase:
                    drive_path = f"{drive_letter}:\\"
                    if os.path.exists(drive_path):
                        available_drives.append(FileItem(
                            name=f"{drive_letter}:",
                            path=drive_path,
                            is_directory=True,
                            size=None,
                            modified_time=None
                        ))
                
                return DirectoryResponse(
                    current_path="",
                    parent_path=None,
                    items=available_drives
                )
            else:
                # 其他系统：使用用户主目录
                path = get_home_directory()
        
        # 确保路径存在
        if not os.path.exists(path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"路径不存在: {path}"
            )
        
        # 确保是目录
        if not os.path.isdir(path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"路径不是目录: {path}"
            )
        
        # 安全检查：确保路径在用户主目录内
        home_dir = get_home_directory()
        if not is_safe_path(path, home_dir):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该路径"
            )
        
        # 获取目录内容
        items = []
        try:
            entries = os.listdir(path)
            # 排序：目录在前，文件在后，然后按名称排序
            entries.sort(key=lambda x: (not os.path.isdir(os.path.join(path, x)), x.lower()))
            
            for entry in entries:
                entry_path = os.path.join(path, entry)
                try:
                    stat_info = os.stat(entry_path)
                    is_dir = os.path.isdir(entry_path)
                    
                    file_item = FileItem(
                        name=entry,
                        path=entry_path,
                        is_directory=is_dir,
                        size=stat_info.st_size if not is_dir else None,
                        modified_time=stat_info.st_mtime
                    )
                    items.append(file_item)
                except (OSError, PermissionError):
                    # 跳过无法访问的文件/目录
                    continue
        except PermissionError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该目录"
            )
        
        # 获取父目录
        parent_path = None
        parent_path_obj = Path(path).parent
        parent_path_str = str(parent_path_obj)
        
        if platform.system() == "Windows":
            # Windows上：检查父目录是否是有效的盘符路径
            # 如果是盘符根目录（如 C:\），允许返回
            if len(parent_path_str) == 3 and parent_path_str[1:3] == ":\\":
                parent_path = parent_path_str
            # 检查父目录是否安全（允许所有盘符）
            elif is_safe_path(parent_path_str, home_dir):
                parent_path = parent_path_str
        else:
            # Linux/Mac上检查父目录是否在基础路径内
            if is_safe_path(parent_path_str, home_dir):
                parent_path = parent_path_str
        
        return DirectoryResponse(
            current_path=path,
            parent_path=parent_path,
            items=items
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"读取目录失败: {str(e)}"
        )


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    directory: str = Form(..., description="目标目录路径")
):
    """
    上传文件到指定目录
    """
    try:
        # 安全检查
        home_dir = get_home_directory()
        if not is_safe_path(directory, home_dir):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该目录"
            )
        
        # 确保目录存在
        if not os.path.exists(directory):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"目录不存在: {directory}"
            )
        
        if not os.path.isdir(directory):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"路径不是目录: {directory}"
            )
        
        # 构建文件保存路径（只使用文件名部分，防止路径遍历）
        filename = os.path.basename(file.filename) if file.filename else "uploaded_file"
        file_path = os.path.join(directory, filename)
        
        # 再次安全检查
        if not is_safe_path(file_path, home_dir):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无效的文件路径"
            )
        
        # 保存文件
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        return {
            "success": True,
            "message": "文件上传成功",
            "path": file_path,
            "filename": filename,
            "size": len(content)
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件上传失败: {str(e)}"
        )


@router.get("/download")
async def download_file(
    path: str = Query(..., description="文件路径")
):
    """
    下载文件
    """
    try:
        # 安全检查
        home_dir = get_home_directory()
        if not is_safe_path(path, home_dir):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该文件"
            )
        
        # 确保文件存在
        if not os.path.exists(path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文件不存在: {path}"
            )
        
        if not os.path.isfile(path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"路径不是文件: {path}"
            )
        
        # 返回文件
        return FileResponse(
            path=path,
            filename=os.path.basename(path),
            media_type='application/octet-stream'
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"文件下载失败: {str(e)}"
        )


@router.get("/content", response_model=FileContentResponse)
async def get_file_content(
    path: str = Query(..., description="文件路径"),
    encoding: str = Query("utf-8", description="文件编码")
):
    """
    获取文件内容（用于在线编辑）
    """
    try:
        # 安全检查
        home_dir = get_home_directory()
        if not is_safe_path(path, home_dir):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该文件"
            )
        
        # 确保文件存在
        if not os.path.exists(path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文件不存在: {path}"
            )
        
        if not os.path.isfile(path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"路径不是文件: {path}"
            )
        
        # 检查文件大小（限制为10MB）
        file_size = os.path.getsize(path)
        if file_size > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="文件过大，无法在线编辑（最大10MB）"
            )
        
        # 读取文件内容
        try:
            async with aiofiles.open(path, 'r', encoding=encoding) as f:
                content = await f.read()
        except UnicodeDecodeError:
            # 如果指定编码失败，尝试utf-8
            try:
                async with aiofiles.open(path, 'r', encoding='utf-8') as f:
                    content = await f.read()
                encoding = 'utf-8'
            except UnicodeDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="文件不是文本格式，无法在线编辑"
                )
        
        return FileContentResponse(
            content=content,
            path=path,
            encoding=encoding
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"读取文件失败: {str(e)}"
        )


@router.post("/save")
async def save_file_content(
    path: str = Query(..., description="文件路径"),
    request: FileSaveRequest = Body(...)
):
    """
    保存文件内容（用于在线编辑）
    """
    try:
        # 安全检查
        home_dir = get_home_directory()
        if not is_safe_path(path, home_dir):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="无权访问该文件"
            )
        
        # 确保文件存在
        if not os.path.exists(path):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"文件不存在: {path}"
            )
        
        if not os.path.isfile(path):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"路径不是文件: {path}"
            )
        
        # 保存文件内容
        try:
            async with aiofiles.open(path, 'w', encoding=request.encoding) as f:
                await f.write(request.content)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"保存文件失败: {str(e)}"
            )
        
        return {
            "success": True,
            "message": "文件保存成功",
            "path": path
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"保存文件失败: {str(e)}"
        )

