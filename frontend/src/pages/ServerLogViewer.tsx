import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, Space, Breadcrumb, message, Select } from 'antd'
import { ArrowLeftOutlined, HomeOutlined, CloudServerOutlined } from '@ant-design/icons'
import RealTimeLogViewer from '../components/RealTimeLogViewer'
import { TaskLog, Task } from '../types'
import { multiServerApi } from '../services/multiServerApi'
import { serverConfigManager } from '../services/serverConfig'

const { Title } = Typography
const { Option } = Select

const ServerLogViewer: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<TaskLog[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)

  const [serverConfigState, setServerConfigState] = useState(serverId ? serverConfigManager.getServer(serverId) : null)

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

  const loadData = async () => {
    if (!serverId) return

    setLoading(true)
    try {
      // 先加载任务列表
      const taskList = await multiServerApi.getTasks(serverId)
      setTasks(taskList)
      
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
    <div style={{ padding: '24px' }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {serverConfigState.name} - 日志查看
          </Title>
        </div>
        <Space>
          <Select
            placeholder="选择任务"
            style={{ width: 200 }}
            value={selectedTaskId}
            onChange={handleTaskChange}
            allowClear
            loading={loading}
          >
            {tasks.map(task => (
              <Option key={task.id} value={task.id}>
                {task.name}
              </Option>
            ))}
          </Select>
          <Button onClick={loadData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 日志查看器 */}
      <RealTimeLogViewer 
        logs={logs}
        serverId={serverId}
        selectedTaskId={selectedTaskId}
        currentTask={tasks.find(task => task.id === selectedTaskId)}
      />
    </div>
  )
}

export default ServerLogViewer