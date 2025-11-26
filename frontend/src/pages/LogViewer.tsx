import React, { useState, useEffect } from 'react'
import {
  Typography,
  Select,
  Space,
  Card,
  Row,
  Col,
  Empty,
  Spin,
  Alert,
  Button
} from 'antd'
import { ReloadOutlined, CloudServerOutlined } from '@ant-design/icons'
import LogViewer from '../components/LogViewer'
import RealTimeLogViewer from '../components/RealTimeLogViewer'
import { useTasks, useRunningTasks } from '../hooks/useTasks'
import { useRunningTasksLogs } from '../hooks/useLogs'
import { useServerTasks, useServerTaskLogs } from '../hooks/useMultiServerTasks'
import { Task, ServerConfig } from '../types'
import { serverConfigManager } from '../services/serverConfig'

const { Title, Text } = Typography
const { Option } = Select

const LogViewerPage: React.FC = () => {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [selectedServerId, setSelectedServerId] = useState<string>('')
  const [servers, setServers] = useState<ServerConfig[]>([])

  // 加载服务器配置
  useEffect(() => {
    const loadServers = () => {
      const serverConfigs = serverConfigManager.getServers()
      setServers(serverConfigs)
      if (serverConfigs.length > 0 && !selectedServerId) {
        setSelectedServerId(serverConfigs[0].id)
      }
    }
    loadServers()
  }, [selectedServerId])

  // 根据是否选择了服务器来决定使用哪个API
  const isMultiServerMode = !!selectedServerId

  // 原有的单服务器API（兼容性）
  const { data: allTasks, isLoading: isLoadingTasks } = useTasks()
  const { data: runningTasks, isLoading: isLoadingRunning } = useRunningTasks()
  const { data: runningTasksLogs } = useRunningTasksLogs()

  // 多服务器API
  const { data: serverTasks, isLoading: isLoadingServerTasks } = useServerTasks(selectedServerId)
  const { data: serverLogs, isLoading: isLoadingServerLogs } = useServerTaskLogs(selectedServerId, selectedTaskId || undefined)

  // 根据模式选择数据
  const tasks = isMultiServerMode ? serverTasks : allTasks
  const isLoading = isMultiServerMode ? isLoadingServerTasks : isLoadingTasks
  const logs = isMultiServerMode ? serverLogs : []

  const selectedTask = tasks?.find(task => task.id === selectedTaskId)

  // 自动选择第一个运行中的任务（如果没有选中任务且任务列表已加载）
  useEffect(() => {
    if (!selectedTaskId && tasks && tasks.length > 0) {
      // 优先选择运行中的任务
      const runningTask = tasks.find(task => task.status === 'running')
      if (runningTask) {
        setSelectedTaskId(runningTask.id)
      } else if (tasks.length > 0) {
        // 如果没有运行中的任务，选择第一个任务
        setSelectedTaskId(tasks[0].id)
      }
    }
  }, [tasks, selectedTaskId])

  const handleTaskSelect = (taskId: number) => {
    setSelectedTaskId(taskId)
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>日志查看</Title>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新页面
          </Button>
        </div>

        {/* 服务器选择器 */}
        {servers.length > 0 && (
          <Card size="small">
            <Space align="center">
              <CloudServerOutlined />
              <span>选择服务器：</span>
              <Select
                style={{ width: 300 }}
                value={selectedServerId}
                onChange={setSelectedServerId}
                placeholder="选择要查看日志的服务器"
              >
                {servers.map(server => (
                  <Select.Option key={server.id} value={server.id}>
                    {server.name} ({server.host}:{server.port})
                  </Select.Option>
                ))}
              </Select>
              {selectedServerId && (
                <span style={{ color: '#52c41a' }}>
                  ✓ 已连接到 {servers.find(s => s.id === selectedServerId)?.name}
                </span>
              )}
            </Space>
          </Card>
        )}

        {/* Task Selection */}
        <Card title="选择任务">
          <Space direction="vertical" style={{ width: '100%' }}>
            <div>
              <Text>选择要查看日志的任务：</Text>
              <Select
                style={{ width: '100%', marginTop: '8px' }}
                placeholder="请选择任务"
                value={selectedTaskId}
                onChange={handleTaskSelect}
                showSearch
                optionFilterProp="children"
              >
                {tasks?.map((task) => (
                  <Option key={task.id} value={task.id}>
                    <Space>
                      <Text>{task.name}</Text>
                      <Text type="secondary">({task.status})</Text>
                    </Space>
                  </Option>
                ))}
              </Select>
            </div>
          </Space>
        </Card>

        {/* Selected Task Log Viewer */}
        {selectedTask ? (
          <RealTimeLogViewer
            logs={logs || []}
            serverId={selectedServerId}
            selectedTaskId={selectedTaskId}
          />
        ) : (
          <Card>
            <Empty
              description="请选择一个任务来查看其日志"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </Card>
        )}

        {/* No Tasks Alert */}
        {tasks && tasks.length === 0 && (
          <Alert
            message="暂无任务"
            description="请先在任务管理页面创建任务"
            type="info"
            showIcon
            action={
              <Button
                size="small"
                onClick={() => window.location.href = '/'}
              >
                去创建任务
              </Button>
            }
          />
        )}
      </Space>
    </div>
  )
}

export default LogViewerPage