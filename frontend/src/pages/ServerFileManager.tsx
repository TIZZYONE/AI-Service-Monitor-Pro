import React, { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { 
  Card, 
  Tree, 
  Breadcrumb, 
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
  EditOutlined
} from '@ant-design/icons'
import { multiServerApi } from '../services/multiServerApi'
import { DirectoryResponse, FileItem } from '../types'

const { TextArea } = Input

const { Title } = Typography

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

  // 下载文件
  const handleDownload = useCallback(async (filePath: string, fileName: string) => {
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

    setLoading(true)
    try {
      const response = await multiServerApi.getFileContent(serverId, filePath)
      setEditingFile({ path: filePath, name: fileName })
      setFileContent(response.content)
      setEditDrawerVisible(true)
    } catch (error: any) {
      message.error(error.message || '读取文件失败')
    } finally {
      setLoading(false)
    }
  }, [serverId])

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
                  onClick={() => handleDownload(item.path, item.name)}
                  title="下载"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(item.path, item.name)}
                  title="编辑"
                />
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

  // 初始加载（加载home目录）
  useEffect(() => {
    loadDirectory()
  }, [loadDirectory])

  // 加载子节点（懒加载）
  const onLoadData = async (node: any) => {
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
                  onClick={() => handleDownload(item.path, item.name)}
                  title="下载"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => handleEdit(item.path, item.name)}
                  title="编辑"
                />
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
  }

  // 处理节点展开
  const onExpand = (expandedKeysValue: React.Key[]) => {
    setExpandedKeys(expandedKeysValue)
  }

  // 处理节点选择（点击文件夹）
  const onSelect = (selectedKeys: React.Key[], info: any) => {
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

  // 返回home目录
  const handleGoHome = () => {
    loadDirectory()
  }

  // 生成面包屑路径
  const getBreadcrumbItems = () => {
    if (!currentPath) return []
    
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
            Home
          </Button>
        )
      }
    ]

    let current = ''
    parts.forEach((part, index) => {
      current = current ? `${current}/${part}` : part
      if (index === parts.length - 1) {
        items.push({
          title: <span>{part}</span>
        })
      } else {
        items.push({
          title: (
            <Button 
              type="link" 
              onClick={() => loadDirectory(current)}
              style={{ padding: 0 }}
            >
              {part}
            </Button>
          )
        })
      }
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
              返回Home
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
        
        {/* 面包屑导航 */}
        {currentPath && (
          <Breadcrumb 
            items={getBreadcrumbItems()}
            style={{ marginBottom: 16 }}
          />
        )}
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

