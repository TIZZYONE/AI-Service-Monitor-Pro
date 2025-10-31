import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, Space, message, Spin, Modal } from 'antd'
import TaskCard from '../components/TaskCard'
import TaskForm from '../components/TaskForm'
import { Task, TaskCreate, TaskUpdate } from '../types'
import { multiServerApi } from '../services/multiServerApi'
import { serverConfigManager } from '../services/serverConfig'

const { Title } = Typography

const ServerTaskManager: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

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
      await loadTasks()
    }
    void init()
  }, [serverId, navigate])

  const loadTasks = async () => {
    if (!serverId) return
    
    setLoading(true)
    try {
      const taskList = await multiServerApi.getTasks(serverId)
      setTasks(taskList)
    } catch (error) {
      message.error('加载任务列表失败')
      console.error('加载任务失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTask = () => {
    setEditingTask(null)
    setIsModalVisible(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setIsModalVisible(true)
  }

  const handleSubmitTask = async (taskData: TaskCreate | TaskUpdate) => {
    if (!serverId) return

    try {
      if (editingTask) {
        await multiServerApi.updateTask(serverId, editingTask.id, taskData as TaskUpdate)
        message.success('任务更新成功')
      } else {
        await multiServerApi.createTask(serverId, taskData as TaskCreate)
        message.success('任务创建成功')
      }
      setIsModalVisible(false)
      setEditingTask(null)
      loadTasks()
    } catch (error) {
      message.error(editingTask ? '更新任务失败' : '创建任务失败')
      console.error('任务操作失败:', error)
    }
  }

  const handleCancel = () => {
    setIsModalVisible(false)
    setEditingTask(null)
  }

  const handleDeleteTask = async (taskId: number) => {
    if (!serverId) return

    try {
      await multiServerApi.deleteTask(serverId, taskId)
      message.success('任务删除成功')
      loadTasks()
    } catch (error) {
      message.error('删除任务失败')
      console.error('删除任务失败:', error)
    }
  }

  const handleStartTask = async (taskId: number) => {
    if (!serverId) return

    try {
      await multiServerApi.startTask(serverId, taskId)
      message.success('任务启动成功')
      loadTasks()
    } catch (error) {
      message.error('启动任务失败')
      console.error('启动任务失败:', error)
    }
  }

  const handleStopTask = async (taskId: number) => {
    if (!serverId) return

    try {
      await multiServerApi.stopTask(serverId, taskId)
      message.success('任务停止成功')
      loadTasks()
    } catch (error) {
      message.error('停止任务失败')
      console.error('停止任务失败:', error)
    }
  }

  if (!serverConfigState) {
    return <div>服务器不存在</div>
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>
            {serverConfigState.name} · 任务管理
          </Title>
        </div>
        <Space>
          <Button 
            type="primary"
            onClick={handleCreateTask}
          >
            创建任务
          </Button>
          <Button onClick={loadTasks} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>



      {/* 任务列表 */}
      <Spin spinning={loading}>
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={handleEditTask}
              onDelete={handleDeleteTask}
              onStart={handleStartTask}
              onStop={handleStopTask}
            />
          ))}
        </div>
      </Spin>

      {tasks.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#999' }}>
          暂无任务，点击"创建任务"开始添加
        </div>
      )}

      {/* Task Form Modal */}
      <Modal
        title={editingTask ? '编辑任务' : '创建任务'}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={600}
        destroyOnClose={true}
      >
        <TaskForm
          initialValues={editingTask || undefined}
          onSubmit={handleSubmitTask}
          onCancel={handleCancel}
          loading={loading}
          isEdit={!!editingTask}
        />
      </Modal>
    </div>
  )
}

export default ServerTaskManager
