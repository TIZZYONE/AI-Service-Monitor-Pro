import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, Typography, Space, Breadcrumb, message, Select, Card, Skeleton, Tag } from 'antd'
import { ArrowLeftOutlined, HomeOutlined, CloudServerOutlined, ClockCircleOutlined, AppstoreOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import RealTimeLogViewer from '../components/RealTimeLogViewer'
import { TaskLog, Task } from '../types'
import { multiServerApi } from '../services/multiServerApi'
import { serverConfigManager } from '../services/serverConfig'

const { Title, Text } = Typography
const { Option } = Select

const ServerLogViewer: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)

  const [serverConfigState, setServerConfigState] = useState(serverId ? serverConfigManager.getServer(serverId) : null)

  // 获取当前选中的任务
  const currentTask = tasks.find(task => task.id === selectedTaskId)

  useEffect(() => {
    const init = async () => {
      await serverConfigManager.ensureLoaded()
      const cfg = serverId ? serverConfigManager.getServer(serverId) : null
      setServerConfigState(cfg || null)
      if (!serverId || !cfg) {
        message.error('服务器不存在')
        navigate('/')
        return
      }
      await loadData()
    }
    void init()
  }, [serverId, navigate])

  useEffect(() => {
    // 从 URL 参数中获取 taskId
    const taskIdParam = searchParams.get('taskId')
    if (taskIdParam && serverId) {
      const taskId = parseInt(taskIdParam, 10)
      if (!isNaN(taskId) && tasks.length > 0) {
        // 验证任务是否存在
        const taskExists = tasks.some(task => task.id === taskId)
        if (taskExists && selectedTaskId !== taskId) {
          setSelectedTaskId(taskId)
          // 加载该任务的日志
          multiServerApi.getTaskLogs(serverId, taskId)
            .then(logList => {
              setLogs(logList)
            })
            .catch(error => {
              message.error('加载任务日志失败')
              console.error('加载任务日志失败:', error)
            })
        }
      }
    }
  }, [searchParams, tasks, serverId, selectedTaskId])

  const loadData = async () => {
    if (!serverId) return

    setLoading(true)
    try {
      // 先加载任务列表
      const taskList = await multiServerApi.getTasks(serverId)
      setTasks(taskList)
      
      // 检查 URL 参数中是否有 taskId
      const taskIdParam = searchParams.get('taskId')
      if (taskIdParam) {
        const taskId = parseInt(taskIdParam, 10)
        if (!isNaN(taskId)) {
          const taskExists = taskList.some(task => task.id === taskId)
          if (taskExists) {
            setSelectedTaskId(taskId)
            const logList = await multiServerApi.getTaskLogs(serverId, taskId)
            setLogs(logList)
            setLoading(false)
            return
          }
        }
      }
      
      // 如果有任务，自动选择第一个任务并加载其日志
      if (taskList.length > 0) {
        const firstTask = taskList[0]
        setSelectedTaskId(firstTask.id)
        const logList = await multiServerApi.getTaskLogs(serverId, firstTask.id)
        setLogs(logList)
      } else {
        // 如果没有任务，加载所有正在运行的日志
        const logList = await multiServerApi.getTaskLogs(serverId)
        setLogs(logList)
      }
    } catch (error) {
      message.error('加载数据失败')
      console.error('加载数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleTaskChange = async (taskId: number | undefined) => {
    if (!serverId) return

    setSelectedTaskId(taskId)
    try {
      const logList = await multiServerApi.getTaskLogs(serverId, taskId)
      setLogs(logList)
    } catch (error) {
      message.error('加载任务日志失败')
      console.error('加载任务日志失败:', error)
    }
  }

  if (!serverConfigState) {
    return <div>服务器不存在</div>
  }

  return (
    <div style={{ padding: 0 }}>
      {/* 页面头部 */}
      <Card 
        style={{ 
          marginBottom: 16, 
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
        styles={{ body: { padding: '16px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate(`/servers/${serverId}/tasks`)}
                type="text"
                style={{ padding: '4px 8px' }}
              >
                返回任务管理
              </Button>
              <Title level={2} style={{ margin: 0 }}>
                {serverConfigState.name} - 日志查看
              </Title>
            </div>
            {currentTask && (
              <Space wrap>
                <Tag color={
                  currentTask.status === 'running' ? 'green' :
                  currentTask.status === 'stopped' ? 'red' :
                  currentTask.status === 'pending' ? 'orange' : 'default'
                }>
                  {currentTask.status === 'running' ? '运行中' :
                   currentTask.status === 'stopped' ? '已停止' :
                   currentTask.status === 'pending' ? '等待中' : currentTask.status}
                </Tag>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  创建于 {dayjs(currentTask.created_at).format('YYYY-MM-DD HH:mm')}
                </Text>
              </Space>
            )}
          </div>
          <Space wrap>
            <Select
              placeholder="选择任务"
              style={{ width: 250 }}
              value={selectedTaskId}
              onChange={handleTaskChange}
              allowClear
              loading={loading}
              showSearch
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {tasks.map(task => (
                <Option key={task.id} value={task.id}>
                  <Space>
                    <Tag color={
                      task.status === 'running' ? 'green' :
                      task.status === 'stopped' ? 'red' :
                      task.status === 'pending' ? 'orange' : 'default'
                    } style={{ margin: 0 }}>
                      {task.status === 'running' ? '运行中' :
                       task.status === 'stopped' ? '已停止' :
                       task.status === 'pending' ? '等待中' : task.status}
                    </Tag>
                    {task.name}
                  </Space>
                </Option>
              ))}
            </Select>
            <Button onClick={loadData} loading={loading}>
              刷新
            </Button>
          </Space>
        </div>
      </Card>

      {/* 日志查看器 */}
      {loading && logs.length === 0 ? (
        <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <Skeleton active paragraph={{ rows: 10 }} />
        </Card>
      ) : !selectedTaskId ? (
        <Card 
          style={{ 
            borderRadius: 12, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            textAlign: 'center',
            padding: '48px'
          }}
        >
          <Text type="secondary" style={{ fontSize: '14px' }}>
            请选择一个任务查看日志
          </Text>
        </Card>
      ) : (
        <RealTimeLogViewer 
          logs={logs}
          serverId={serverId}
          selectedTaskId={selectedTaskId}
          currentTask={currentTask}
        />
      )}
    </div>
  )
}

export default ServerLogViewer