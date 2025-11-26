import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, Space, message, Spin, Modal } from 'antd'
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined, CheckSquareOutlined } from '@ant-design/icons'
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
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [batchStarting, setBatchStarting] = useState(false)

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
      // 清理无效的选中状态（任务已被删除的情况）
      setSelectedTaskIds(prev => {
        const validIds = new Set(taskList.map(t => t.id))
        return new Set([...prev].filter(id => validIds.has(id)))
      })
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
      // 从选中列表中移除
      setSelectedTaskIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(taskId)
        return newSet
      })
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

  const handleSelectChange = (taskId: number, selected: boolean) => {
    setSelectedTaskIds(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(taskId)
      } else {
        newSet.delete(taskId)
      }
      return newSet
    })
  }


  if (!serverConfigState) {
    return <div>服务器不存在</div>
  }

  const handleSelectAll = () => {
    if (selectedTaskIds.size === tasks.length) {
      // 如果已全选，则取消全选
      setSelectedTaskIds(new Set())
    } else {
      // 否则全选所有任务
      setSelectedTaskIds(new Set(tasks.map(task => task.id)))
    }
  }

  const handleStartAll = async () => {
    if (!serverId) return

    // 如果没有选择任务，启动所有未运行的任务
    const tasksToStart = selectedTaskIds.size === 0
      ? tasks.filter(task => task.status !== 'running')
      : tasks.filter(task => selectedTaskIds.has(task.id) && task.status !== 'running')

    if (tasksToStart.length === 0) {
      message.warning(selectedTaskIds.size === 0 
        ? '所有任务都在运行中' 
        : '所选任务中没有可启动的任务（所有任务都在运行中）')
      return
    }

    setBatchStarting(true)
    let successCount = 0
    let failCount = 0

    try {
      // 并发启动所有任务
      await Promise.allSettled(
        tasksToStart.map(async (task) => {
          try {
            await multiServerApi.startTask(serverId, task.id)
            successCount++
          } catch (error) {
            failCount++
            console.error(`启动任务 ${task.id} 失败:`, error)
          }
        })
      )

      if (successCount > 0) {
        message.success(`成功启动 ${successCount} 个任务${failCount > 0 ? `，${failCount} 个失败` : ''}`)
      } else {
        message.error('所有任务启动失败')
      }

      // 清空选择
      setSelectedTaskIds(new Set())
      // 刷新任务列表
      await loadTasks()
    } catch (error) {
      message.error('批量启动任务失败')
      console.error('批量启动任务失败:', error)
    } finally {
      setBatchStarting(false)
    }
  }

  return (
    <div style={{ padding: '16px 24px' }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 600, marginBottom: 16 }}>
          {serverConfigState.name} · 任务管理
        </Title>
        <Space>
          <Button 
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleStartAll}
            loading={batchStarting}
          >
            一键启动{selectedTaskIds.size > 0 ? ` (${selectedTaskIds.size})` : ''}
          </Button>
          <Button 
            icon={<CheckSquareOutlined />}
            onClick={handleSelectAll}
            type={selectedTaskIds.size === tasks.length && tasks.length > 0 ? 'primary' : 'default'}
          >
            {selectedTaskIds.size === tasks.length && tasks.length > 0 ? '取消全选' : '全选'}
          </Button>
          <Button 
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateTask}
          >
            创建任务
          </Button>
          <Button 
            icon={<ReloadOutlined />}
            onClick={loadTasks} 
            loading={loading}
          >
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
              selected={selectedTaskIds.has(task.id)}
              onSelectChange={handleSelectChange}
              showCheckbox={true}
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
