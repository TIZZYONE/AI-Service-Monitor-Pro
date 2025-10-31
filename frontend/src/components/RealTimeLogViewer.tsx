import React, { useEffect, useRef, useState } from 'react'
import { Card, Typography, Button, Space, Alert, Badge, Select, List } from 'antd'
import { 
  DownloadOutlined,
  WifiOutlined,
  DisconnectOutlined,
  FileTextOutlined
} from '@ant-design/icons'
import useWebSocket from '../hooks/useWebSocket'
import { TaskLog, Task } from '../types'
import { multiServerApi } from '../services/multiServerApi'
import { serverConfigManager } from '../services/serverConfig'

const { Text } = Typography
const { Option } = Select

interface RealTimeLogViewerProps {
  logs: TaskLog[]
  serverId?: string
  selectedTaskId?: number
  currentTask?: Task
  height?: number
}

const RealTimeLogViewer: React.FC<RealTimeLogViewerProps> = ({ 
  logs,
  serverId,
  selectedTaskId,
  currentTask,
  height = 400 
}) => {
  const [logContent, setLogContent] = useState('')
  const [selectedLogPath, setSelectedLogPath] = useState<string>('')

  const [autoScroll, setAutoScroll] = useState(true)
  const [loading, setLoading] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userScrollingRef = useRef(false)

  // 过滤日志
  const filteredLogs = selectedTaskId 
    ? logs.filter(log => log.task_id === selectedTaskId)
    : logs

  // WebSocket连接（如果有选中的任务）
  const wsUrl = serverId && selectedTaskId && selectedTaskId !== undefined && selectedTaskId !== null
    ? (() => {
        const baseUrl = serverConfigManager.getServerUrl(serverId)
        if (!baseUrl) return null
        const wsUrl = baseUrl.replace('http://', 'ws://').replace('https://', 'wss://')
        return `${wsUrl}/ws/logs/${selectedTaskId}`
      })()
    : null

  const { isConnected, reconnectCount } = useWebSocket(wsUrl, {
    onMessage: (data) => {
      if (data.type === 'initial_log') {
        // 初始日志内容，直接设置
        setLogContent(data.content)
      } else if (data.type === 'log_update') {
        // 增量日志内容，追加到现有内容
        setLogContent(prev => prev + data.content)
      } else if (data.type === 'status_update') {
        console.log('Task status updated:', data.status)
      } else if (data.type === 'error') {
        console.error('WebSocket error message:', data.message)
      }
    },
    onOpen: () => {
      console.log('WebSocket connected for task:', selectedTaskId)
    },
    onClose: () => {
      console.log('WebSocket disconnected for task:', selectedTaskId)
    },
    onError: (error) => {
      console.error('WebSocket error for task:', selectedTaskId, error)
    }
  })

  // 加载日志文件内容
  const loadLogContent = async (logPath: string) => {
    if (!serverId || !selectedTaskId) return
    
    setLoading(true)
    try {
      const result = await multiServerApi.getLogContent(serverId, selectedTaskId, logPath)
      setLogContent(result.content)
    } catch (error) {
      console.error('加载日志内容失败:', error)
      setLogContent('加载日志内容失败')
    } finally {
      setLoading(false)
    }
  }

  // 选择日志文件
  const handleLogSelect = (logPath: string) => {
    setSelectedLogPath(logPath)
    loadLogContent(logPath)
  }

  // 当任务ID改变时重置状态
  useEffect(() => {
    setSelectedLogPath('')
    setLogContent('')
  }, [selectedTaskId])

  // 自动加载最新日志文件（仅在没有手动选择时）
  useEffect(() => {
    if (filteredLogs.length > 0 && selectedTaskId && !selectedLogPath) {
      // 按开始时间排序，获取最新的日志文件
      const sortedLogs = [...filteredLogs].sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      )
      const latestLog = sortedLogs[0]
      
      // 只有在没有选中任何日志文件时才自动选择最新的
      if (latestLog) {
        setSelectedLogPath(latestLog.log_file_path)
        loadLogContent(latestLog.log_file_path)
      }
    }
  }, [filteredLogs, selectedTaskId])

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && logContainerRef.current && !userScrollingRef.current) {
      // 使用 setTimeout 确保 DOM 更新完成后再滚动
      setTimeout(() => {
        if (logContainerRef.current && autoScroll && !userScrollingRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
      }, 10)
    }
  }, [logContent, autoScroll])

  // 自动刷新正在运行任务的日志内容
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    // 判断当前选择的是否为最新日志
    const isLatestLog = () => {
      if (!selectedLogPath || filteredLogs.length === 0) return false
      
      // 按开始时间排序，获取最新的日志文件
      const sortedLogs = [...filteredLogs].sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      )
      const latestLog = sortedLogs[0]
      
      return latestLog?.log_file_path === selectedLogPath
    }

    // 只有在以下条件下才启用自动刷新：
    // 1. 当前任务状态为 'running'
    // 2. 有选中的日志文件路径
    // 3. 选择的是最新的日志文件
    // 4. 没有WebSocket连接（避免与实时更新冲突）
    const shouldAutoRefresh = 
      currentTask?.status === 'running' && 
      selectedLogPath && 
      isLatestLog() &&
      !wsUrl

    if (shouldAutoRefresh) {
      // 每5秒刷新一次日志内容
      intervalId = setInterval(() => {
        loadLogContent(selectedLogPath)
      }, 5000)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [currentTask?.status, selectedLogPath, wsUrl, filteredLogs, loadLogContent])

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])



  const handleDownload = () => {
    if (!logContent) return
    
    const blob = new Blob([logContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `log_${selectedTaskId || 'all'}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getConnectionStatus = () => {
    if (isConnected) {
      return (
        <Badge status="success" text={
          <Space>
            <WifiOutlined />
            <Text type="success">已连接</Text>
          </Space>
        } />
      )
    } else {
      return (
        <Badge status="error" text={
          <Space>
            <DisconnectOutlined />
            <Text type="danger">
              连接断开 {reconnectCount > 0 && `(重连次数: ${reconnectCount})`}
            </Text>
          </Space>
        } />
      )
    }
  }

  return (
    <Card
      title={
        <Space>
          <Text strong>
            日志查看器 
            {selectedTaskId && ` - 任务 ${selectedTaskId}`}
          </Text>
          {wsUrl && getConnectionStatus()}
        </Space>
      }
      extra={
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          disabled={!logContent}
        >
          下载
        </Button>
      }
    >
      <div style={{ marginBottom: '16px' }}>
        {/* 日志文件列表 */}
        {filteredLogs.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <Text type="secondary" style={{ marginRight: '8px' }}>选择日志文件：</Text>
            <Select
              style={{ width: 600 }}
              placeholder="选择要查看的日志文件"
              value={selectedLogPath}
              onChange={handleLogSelect}
              loading={loading}
              dropdownStyle={{ maxWidth: 650 }}
            >
              {filteredLogs.map((log) => (
                <Option key={log.log_file_path} value={log.log_file_path}>
                  <Space>
                    <FileTextOutlined />
                    {log.log_file_path.split('/').pop() || log.log_file_path}
                    <Text type="secondary">
                      ({new Date(log.start_time).toLocaleString()})
                    </Text>
                  </Space>
                </Option>
              ))}
            </Select>
          </div>
        )}

        {/* 状态提示 */}
        {wsUrl ? (
          <Alert
            message={
              isConnected
                ? "正在显示实时日志，通过WebSocket实时更新"
                : "WebSocket连接断开，正在尝试重连..."
            }
            type={isConnected ? "info" : "error"}
            showIcon
            style={{ marginBottom: '12px' }}
          />
        ) : (
          <Alert
            message="选择日志文件查看历史日志内容"
            type="info"
            showIcon
            style={{ marginBottom: '12px' }}
          />
        )}
        
        <Space>
          <Text type="secondary">自动滚动：</Text>
          <Button
            size="small"
            type={autoScroll ? 'primary' : 'default'}
            onClick={() => setAutoScroll(!autoScroll)}
          >
            {autoScroll ? '已开启' : '已关闭'}
          </Button>
        </Space>
      </div>

      <div
        ref={logContainerRef}
        className="log-viewer"
        style={{ 
          height: `${height}px`,
        }}
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
          
          // 标记用户正在滚动
          userScrollingRef.current = true
          
          // 清除之前的定时器
          if (scrollTimeoutRef.current) {
            clearTimeout(scrollTimeoutRef.current)
          }
          
          // 如果用户滚动到非底部位置，关闭自动滚动
          if (!isAtBottom && autoScroll) {
            setAutoScroll(false)
          }
          
          // 如果用户滚动到底部，重新开启自动滚动
          if (isAtBottom && !autoScroll) {
            setAutoScroll(true)
          }
          
          // 500ms后标记用户停止滚动
          scrollTimeoutRef.current = setTimeout(() => {
            userScrollingRef.current = false
          }, 500)
        }}
      >
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {logContent || '等待日志输出...'}
        </pre>
      </div>
    </Card>
  )
}

export default RealTimeLogViewer