import React, { useEffect, useRef, useState } from 'react'
import { Card, Typography, Button, Space, Select, Spin, Empty, Alert } from 'antd'
import { 
  ReloadOutlined, 
  ClearOutlined, 
  DownloadOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import { useLatestLogContent, useTaskLogs, useLogContent } from '../hooks/useLogs'
import { Task } from '../types'

const { Text } = Typography
const { Option } = Select

interface LogViewerProps {
  task: Task
  height?: number
}

const LogViewer: React.FC<LogViewerProps> = ({ task, height = 400 }) => {
  const [selectedLogId, setSelectedLogId] = useState<number | string | null>(
    task.status === 'running' ? 'realtime' : null
  )
  const [autoScroll, setAutoScroll] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // 获取任务的日志文件列表
  const { data: logs } = useTaskLogs(task.id)

  // 当任务不在运行且没有选择日志时，自动选择最新的日志文件
  useEffect(() => {
    if (task.status !== 'running' && !selectedLogId && logs && logs.length > 0) {
      // 选择最新的日志文件（按创建时间排序）
      const latestLog = logs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      setSelectedLogId(latestLog.id)
    }
  }, [task.status, selectedLogId, logs])

  // 根据选择的日志ID获取日志内容
  const shouldFetchRealTime = 
    task.status === 'running' && !isPaused && selectedLogId === 'realtime'

  const { data: logContent, isLoading } = useLatestLogContent(
    task.id,
    shouldFetchRealTime
  )

  // 获取选中的日志文件路径
  const selectedLog = selectedLogId && selectedLogId !== 'realtime'
    ? logs?.find(log => log.id === selectedLogId)
    : null

  // 获取选中日志文件的内容
  const { data: selectedLogContent, isLoading: isLoadingSelected } = useLogContent(
    task.id,
    selectedLog?.log_file_path || ''
  )

  // 自动滚动到底部
  const currentContent = selectedLogId === 'realtime' ? logContent?.content : selectedLogContent?.content
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [currentContent, autoScroll])

  const handleLogSelect = (logId: number | string | null) => {
    setSelectedLogId(logId)
    setIsPaused(false)
  }

  const handleTogglePause = () => {
    setIsPaused(!isPaused)
  }

  // 显示的内容：选中特定日志时显示该日志，否则显示实时日志
  const displayContent = selectedLogId === 'realtime'
    ? logContent?.content || '暂无日志内容'
    : selectedLogContent?.content || '日志内容加载中...'

  const currentIsLoading = selectedLogId === 'realtime' ? isLoading : isLoadingSelected

  const handleDownload = () => {
    if (!logContent?.content) return
    
    const blob = new Blob([logContent.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `task_${task.id}_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleClear = () => {
    // 这里可以添加清空日志的逻辑
    console.log('Clear logs for task:', task.id)
  }

  const getLogContent = () => {
    return displayContent
  }

  const isRealTimeMode = selectedLogId === 'realtime' && task.status === 'running'

  return (
    <Card
      title={
        <Space>
          <Text strong>任务日志 - {task.name}</Text>
          {task.status === 'running' && (
            <Text type="success" style={{ fontSize: '12px' }}>
              ● 运行中
            </Text>
          )}
        </Space>
      }
      extra={
        <Space>
          {/* 日志文件选择 */}
          <Select
            style={{ width: 200 }}
            placeholder="选择日志文件"
            value={selectedLogId}
            onChange={handleLogSelect}
            allowClear
          >
            <Option value="realtime">实时日志</Option>
            {logs?.map((log) => (
              <Option key={log.id} value={log.id}>
                {new Date(log.start_time).toLocaleString()}
              </Option>
            ))}
          </Select>

          {/* 控制按钮 */}
          {isRealTimeMode && (
            <Button
              icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={handleTogglePause}
              type={isPaused ? 'primary' : 'default'}
            >
              {isPaused ? '继续' : '暂停'}
            </Button>
          )}

          <Button
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={!logContent?.content}
          >
            下载
          </Button>

          <Button
            icon={<ClearOutlined />}
            onClick={handleClear}
          >
            清空
          </Button>

          <Button
            icon={<ReloadOutlined />}
            loading={currentIsLoading}
            onClick={() => window.location.reload()}
          >
            刷新
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: '16px' }}>
        {isRealTimeMode && (
          <Alert
            message={
              isPaused 
                ? "实时日志已暂停，点击继续按钮恢复更新" 
                : "正在显示实时日志，每2秒自动更新"
            }
            type={isPaused ? "warning" : "info"}
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
          position: 'relative'
        }}
        onScroll={(e) => {
          const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
          if (!isAtBottom && autoScroll) {
            setAutoScroll(false)
          }
        }}
      >
        {currentIsLoading && (
          <div style={{ 
            position: 'absolute', 
            top: '50%', 
            left: '50%', 
            transform: 'translate(-50%, -50%)',
            zIndex: 1
          }}>
            <Spin />
          </div>
        )}
        
        {getLogContent() ? (
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {getLogContent()}
          </pre>
        ) : (
          <Empty 
            description="暂无日志内容" 
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center',
              height: '100%'
            }}
          />
        )}
      </div>
    </Card>
  )
}

export default LogViewer