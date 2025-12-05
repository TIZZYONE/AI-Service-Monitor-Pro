import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Card, 
  Tree, 
  Spin, 
  message, 
  Empty,
  Typography,
  Space,
  Button,
  Tag,
  Input,
  Upload,
  Drawer
} from 'antd'
import { 
  FolderOutlined, 
  FileOutlined, 
  HomeOutlined,
  ReloadOutlined,
  ArrowUpOutlined,
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  EnterOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'
import { multiServerApi } from '../services/multiServerApi'
import { DirectoryResponse } from '../types'

const { TextArea } = Input

const { Title } = Typography

// 文本文件扩展名列表
const TEXT_FILE_EXTENSIONS = [
  'txt', 'md', 'json', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx',
  'py', 'java', 'cpp', 'c', 'h', 'hpp', 'cs', 'go', 'rs', 'php', 'rb', 'swift',
  'sh', 'bat', 'ps1', 'yml', 'yaml', 'ini', 'cfg', 'conf', 'config', 'log',
  'sql', 'vue', 'svelte', 'dart', 'kt', 'scala', 'r', 'm', 'pl', 'lua',
  'properties', 'env', 'gitignore', 'dockerfile', 'makefile', 'cmake'
]

// 检查文件是否为文本文件
const isTextFile = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return false
  return TEXT_FILE_EXTENSIONS.includes(ext)
}

interface TreeNode {
  title: React.ReactNode
  key: string
  path: string
  isLeaf: boolean
  isDirectory: boolean
  children?: TreeNode[]
}

const ServerFileManager: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>()
  const [loading, setLoading] = useState(false)
  const [currentPath, setCurrentPath] = useState<string>('')
  const [parentPath, setParentPath] = useState<string | undefined>()
  const [treeData, setTreeData] = useState<TreeNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  
  // 文件编辑相关状态
  const [editDrawerVisible, setEditDrawerVisible] = useState(false)
  const [editingFile, setEditingFile] = useState<{ path: string; name: string } | null>(null)
  const [fileContent, setFileContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // 路径输入框相关状态
  const [pathInputValue, setPathInputValue] = useState('')
  const [isEditingPath, setIsEditingPath] = useState(false)

  // 下载文件
  const handleDownload = useCallback(async (filePath: string) => {
    if (!serverId) return

    try {
      await multiServerApi.downloadFile(serverId, filePath)
      message.success('文件下载成功')
    } catch (error: any) {
      message.error(error.message || '文件下载失败')
    }
  }, [serverId])

  // 编辑文件
  const handleEdit = useCallback(async (filePath: string, fileName: string) => {
    if (!serverId) return

    // 再次检查是否为文本文件
    if (!isTextFile(fileName)) {
      message.warning('只能编辑文本文件')
      return
    }

    setLoading(true)
    try {
      const response = await multiServerApi.getFileContent(serverId, filePath)
      setEditingFile({ path: filePath, name: fileName })
      setFileContent(response.content)
      setEditDrawerVisible(true)
    } catch (error: any) {
      // 尝试从错误响应中提取详细信息
      let errorMessage = '读取文件失败'
      if (error.message) {
        errorMessage = error.message
      } else if (error.response) {
        try {
          const errorData = await error.response.json()
          errorMessage = errorData.detail || errorData.message || errorMessage
        } catch {
          errorMessage = `读取文件失败: ${error.response.status} ${error.response.statusText}`
        }
      }
      message.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [serverId])

  // 加载目录内容
  const loadDirectory = useCallback(async (path?: string) => {
    if (!serverId) return

    setLoading(true)
    try {
      const response: DirectoryResponse = await multiServerApi.listDirectory(serverId, path)
      setCurrentPath(response.current_path)
      setParentPath(response.parent_path)

      // 转换数据为树形结构
      const nodes: TreeNode[] = response.items.map(item => ({
        title: (
          <Space>
            {item.is_directory ? (
              <FolderOutlined style={{ color: '#1890ff' }} />
            ) : (
              <FileOutlined style={{ color: '#999' }} />
            )}
            <span>{item.name}</span>
            {!item.is_directory && item.size && (
              <Tag style={{ margin: 0, fontSize: '11px' }}>
                {(item.size / 1024).toFixed(1)} KB
              </Tag>
            )}
            {!item.is_directory && (
              <Space size="small" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(item.path)}
                  title="下载"
                />
                {isTextFile(item.name) && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(item.path, item.name)}
                    title="编辑"
                  />
                )}
              </Space>
            )}
          </Space>
        ),
        key: item.path,
        path: item.path,
        isLeaf: !item.is_directory,
        isDirectory: item.is_directory,
        children: item.is_directory ? [] : undefined
      }))

      setTreeData(nodes)
      
      // 如果展开的keys中包含当前路径，保持展开
      setExpandedKeys(prev => {
        if (prev.includes(response.current_path)) {
          return [...prev]
        }
        return prev
      })
    } catch (error: any) {
      message.error(error.message || '加载目录失败')
      console.error('加载目录失败:', error)
    } finally {
      setLoading(false)
    }
  }, [serverId, handleDownload, handleEdit])

  // 上传文件
  const handleUpload = useCallback(async (file: File) => {
    if (!serverId) return false

    setUploading(true)
    try {
      await multiServerApi.uploadFile(serverId, file, currentPath || '')
      message.success('文件上传成功')
      loadDirectory(currentPath || undefined)
      return false // 阻止默认上传行为
    } catch (error: any) {
      message.error(error.message || '文件上传失败')
      return false
    } finally {
      setUploading(false)
    }
  }, [serverId, currentPath, loadDirectory])

  // 保存文件
  const handleSaveFile = async () => {
    if (!serverId || !editingFile) return

    setSaving(true)
    try {
      await multiServerApi.saveFileContent(serverId, editingFile.path, fileContent)
      message.success('文件保存成功')
      setEditDrawerVisible(false)
      setEditingFile(null)
      setFileContent('')
    } catch (error: any) {
      message.error(error.message || '文件保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 取消编辑
  const handleCancelEdit = () => {
    setEditDrawerVisible(false)
    setEditingFile(null)
    setFileContent('')
  }

  // 初始加载（加载根目录）
  useEffect(() => {
    loadDirectory()
  }, [loadDirectory])
  
  // 同步路径输入框的值
  useEffect(() => {
    if (!isEditingPath) {
      setPathInputValue(currentPath || '')
    }
  }, [currentPath, isEditingPath])
  
  // 处理路径输入框的跳转
  const handlePathNavigate = useCallback(() => {
    const path = pathInputValue.trim()
    if (path) {
      loadDirectory(path)
    } else {
      // 如果为空，返回根目录
      loadDirectory(undefined)
    }
    setIsEditingPath(false)
  }, [pathInputValue, loadDirectory])
  
  // 处理路径输入框的键盘事件
  const handlePathInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handlePathNavigate()
    } else if (e.key === 'Escape') {
      setPathInputValue(currentPath || '')
      setIsEditingPath(false)
    }
  }

  // 加载子节点（懒加载）
  const onLoadData = useCallback(async (node: any) => {
    if (!serverId || !node.isDirectory || node.children?.length > 0) {
      return
    }

    try {
      const response: DirectoryResponse = await multiServerApi.listDirectory(serverId, node.path)
      
      const children: TreeNode[] = response.items.map(item => ({
        title: (
          <Space>
            {item.is_directory ? (
              <FolderOutlined style={{ color: '#1890ff' }} />
            ) : (
              <FileOutlined style={{ color: '#999' }} />
            )}
            <span>{item.name}</span>
            {!item.is_directory && item.size && (
              <Tag style={{ margin: 0, fontSize: '11px' }}>
                {(item.size / 1024).toFixed(1)} KB
              </Tag>
            )}
            {!item.is_directory && (
              <Space size="small" onClick={(e) => e.stopPropagation()}>
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(item.path)}
                  title="下载"
                />
                {isTextFile(item.name) && (
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(item.path, item.name)}
                    title="编辑"
                  />
                )}
              </Space>
            )}
          </Space>
        ),
        key: item.path,
        path: item.path,
        isLeaf: !item.is_directory,
        isDirectory: item.is_directory,
        children: item.is_directory ? [] : undefined
      }))

      // 更新树数据
      const updateTreeData = (list: TreeNode[], key: React.Key, children: TreeNode[]): TreeNode[] => {
        return list.map(node => {
          if (node.key === key) {
            return {
              ...node,
              children
            }
          }
          if (node.children) {
            return {
              ...node,
              children: updateTreeData(node.children, key, children)
            }
          }
          return node
        })
      }

      setTreeData(origin => updateTreeData(origin, node.key, children))
    } catch (error: any) {
      message.error(`加载目录失败: ${error.message || '未知错误'}`)
      console.error('加载子目录失败:', error)
    }
  }, [serverId, handleDownload, handleEdit])

  // 处理节点展开
  const onExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue)
  }

  // 处理节点选择（点击文件夹）
  const onSelect = (_selectedKeys: React.Key[], info: any) => {
    const node = info.node
    if (node.isDirectory) {
      // 如果是目录，加载该目录的内容
      loadDirectory(node.path)
    }
  }

  // 返回上一级
  const handleGoUp = () => {
    if (parentPath) {
      loadDirectory(parentPath)
    }
  }

  // 返回根目录
  const handleGoHome = useCallback(() => {
    // 强制重置状态并加载根目录
    setCurrentPath('')
    setParentPath(undefined)
    setTreeData([])
    setExpandedKeys([])
    // 使用 undefined 明确表示加载根目录
    loadDirectory(undefined)
  }, [loadDirectory])

  // 生成面包屑路径
  const getBreadcrumbItems = () => {
    if (!currentPath) return []
    
    // 检测路径分隔符（Windows使用反斜杠，Unix使用正斜杠）
    const isWindowsPath = currentPath.includes('\\')
    const separator = isWindowsPath ? '\\' : '/'
    
    // 分割路径
    const parts = currentPath.split(/[/\\]/).filter(Boolean)
    const items = [
      {
        title: (
          <Button 
            type="link" 
            icon={<HomeOutlined />} 
            onClick={handleGoHome}
            style={{ padding: 0 }}
          >
            根目录
          </Button>
        )
      }
    ]

    // 构建路径片段，每个片段都可以点击
    let accumulatedPath = ''
    parts.forEach((part, index) => {
      // 构建当前路径片段
      if (isWindowsPath) {
        // Windows路径：第一个部分是盘符（如 C:），需要特殊处理
        if (index === 0 && part.endsWith(':')) {
          accumulatedPath = part + separator
        } else {
          accumulatedPath = accumulatedPath ? `${accumulatedPath}${separator}${part}` : part
        }
      } else {
        // Unix路径：确保有前导斜杠
        if (index === 0) {
          accumulatedPath = separator + part
        } else {
          accumulatedPath = accumulatedPath + separator + part
        }
      }
      
      // 所有路径片段都可以点击
      items.push({
        title: (
          <Button 
            type="link" 
            onClick={() => loadDirectory(accumulatedPath)}
            style={{ padding: 0 }}
          >
            {part}
          </Button>
        )
      })
    })

    return items
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        style={{ 
          marginBottom: 16, 
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ margin: 0 }}>文件管理</Title>
          <Space>
            <Upload
              beforeUpload={handleUpload}
              showUploadList={false}
              disabled={uploading}
            >
              <Button 
                icon={<UploadOutlined />}
                loading={uploading}
              >
                上传文件
              </Button>
            </Upload>
            {parentPath && (
              <Button 
                icon={<ArrowUpOutlined />}
                onClick={handleGoUp}
              >
                返回上级
              </Button>
            )}
            <Button 
              icon={<HomeOutlined />}
              onClick={handleGoHome}
            >
              返回根目录
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={() => loadDirectory(currentPath || undefined)}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>
        
        {/* 路径导航栏 */}
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%', maxWidth: '800px' }}>
            <Input
              value={pathInputValue}
              onChange={(e) => {
                setPathInputValue(e.target.value)
                setIsEditingPath(true)
              }}
              onBlur={() => {
                // 失去焦点时，如果值未改变，取消编辑状态
                if (pathInputValue === currentPath) {
                  setIsEditingPath(false)
                }
              }}
              onKeyDown={handlePathInputKeyDown}
              placeholder="输入路径或点击路径片段导航"
              prefix={<FolderOpenOutlined style={{ color: '#1890ff' }} />}
              suffix={
                isEditingPath ? (
                  <Space size="small">
                    <Button
                      type="text"
                      size="small"
                      icon={<EnterOutlined />}
                      onClick={handlePathNavigate}
                      title="跳转 (Enter)"
                    />
                    <Button
                      type="text"
                      size="small"
                      onClick={() => {
                        setPathInputValue(currentPath || '')
                        setIsEditingPath(false)
                      }}
                      title="取消 (Esc)"
                    >
                      ✕
                    </Button>
                  </Space>
                ) : (
                  <Button
                    type="text"
                    size="small"
                    onClick={() => setIsEditingPath(true)}
                    title="编辑路径"
                  >
                    编辑
                  </Button>
                )
              }
              style={{ 
                fontFamily: 'monospace',
                fontSize: '13px'
              }}
            />
          </Space.Compact>
          
          {/* 路径片段快速导航 */}
          {currentPath && !isEditingPath && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              <Button
                type="text"
                size="small"
                icon={<HomeOutlined />}
                onClick={handleGoHome}
                style={{ fontSize: '12px', padding: '0 8px' }}
              >
                根目录
              </Button>
              {getBreadcrumbItems().slice(1).map((item, index) => (
                <React.Fragment key={index}>
                  <span style={{ color: '#d9d9d9', margin: '0 4px' }}>/</span>
                  {item.title}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* 文件树 */}
      <Card 
        style={{ 
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          minHeight: '400px'
        }}
        styles={{ body: { padding: '16px' } }}
      >
        {loading && treeData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : treeData.length === 0 ? (
          <Empty description="目录为空" />
        ) : (
          <Tree
            showLine
            showIcon
            loadData={onLoadData}
            onExpand={onExpand}
            onSelect={onSelect}
            treeData={treeData}
            expandedKeys={expandedKeys}
            style={{ background: 'transparent' }}
          />
        )}
      </Card>

      {/* 文件编辑抽屉 */}
      <Drawer
        title={`编辑文件: ${editingFile?.name || ''}`}
        open={editDrawerVisible}
        onClose={handleCancelEdit}
        width={800}
        extra={
          <Space>
            <Button onClick={handleCancelEdit}>取消</Button>
            <Button type="primary" onClick={handleSaveFile} loading={saving}>
              保存
            </Button>
          </Space>
        }
      >
        <TextArea
          value={fileContent}
          onChange={(e) => setFileContent(e.target.value)}
          rows={30}
          style={{ fontFamily: 'monospace', fontSize: '13px' }}
          placeholder="文件内容..."
        />
      </Drawer>
    </div>
  )
}

export default ServerFileManager

