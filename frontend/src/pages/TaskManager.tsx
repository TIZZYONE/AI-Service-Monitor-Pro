import React, { useState, useEffect } from 'react'
import { 
  Button, 
  Modal, 
  Row, 
  Col, 
  Typography, 
  Space, 
  Spin, 
  Empty,
  Alert,
  Select,
  Card
} from 'antd'
import { PlusOutlined, ReloadOutlined, CloudServerOutlined } from '@ant-design/icons'
import TaskCard from '../components/TaskCard'
import TaskForm from '../components/TaskForm'
import { 
  useTasks, 
  useCreateTask, 
  useUpdateTask, 
  useDeleteTask,
  useStartTask,
  useStopTask
} from '../hooks/useTasks'
import {
  useServerTasks,
  useCreateServerTask,
  useUpdateServerTask,
  useDeleteServerTask,
  useStartServerTask,
  useStopServerTask
} from '../hooks/useMultiServerTasks'
import { Task, TaskCreate, TaskUpdate, ServerConfig } from '../types'
import { serverConfigManager } from '../services/serverConfig'

const { Title } = Typography

const TaskManager: React.FC = () => {
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedServerId, setSelectedServerId] = useState<string>('')
  const [servers, setServers] = useState<ServerConfig[]>([])

  // 加载服务器配置
  useEffect(() => {
    const loadServers = async () => {
      await serverConfigManager.ensureLoaded()
      const serverConfigs = serverConfigManager.getServers()
      setServers(serverConfigs)
      if (serverConfigs.length > 0 && !selectedServerId) {
        setSelectedServerId(serverConfigs[0].id)
      }
    }
    void loadServers()
  }, [selectedServerId])

  // 根据是否选择了服务器来决定使用哪个API
  const isMultiServerMode = !!selectedServerId

  // 原有的单服务器API（兼容性）
  const { data: localTasks, isLoading: localLoading, refetch: localRefetch } = useTasks()
  const createTaskMutation = useCreateTask()
  const updateTaskMutation = useUpdateTask()
  const deleteTaskMutation = useDeleteTask()
  const startTaskMutation = useStartTask()
  const stopTaskMutation = useStopTask()

  // 多服务器API
  const { data: serverTasks, isLoading: serverLoading, refetch: serverRefetch } = useServerTasks(selectedServerId)
  const createServerTaskMutation = useCreateServerTask()
  const updateServerTaskMutation = useUpdateServerTask()
  const deleteServerTaskMutation = useDeleteServerTask()
  const startServerTaskMutation = useStartServerTask()
  const stopServerTaskMutation = useStopServerTask()

  // 根据模式选择数据和操作
  const tasks = isMultiServerMode ? serverTasks : localTasks
  const isLoading = isMultiServerMode ? serverLoading : localLoading
  const refetch = isMultiServerMode ? serverRefetch : localRefetch

  const handleCreateTask = () => {
    setEditingTask(null)
    setIsModalVisible(true)
  }

  const handleEditTask = (task: Task) => {
    setEditingTask(task)
    setIsModalVisible(true)
  }

  const handleSubmitTask = async (values: TaskCreate | TaskUpdate) => {
    try {
      if (editingTask) {
        if (isMultiServerMode) {
          await updateServerTaskMutation.mutateAsync({ 
            serverId: selectedServerId,
            taskId: editingTask.id, 
            task: values as TaskUpdate 
          })
        } else {
          await updateTaskMutation.mutateAsync({ 
            id: editingTask.id, 
            task: values as TaskUpdate 
          })
        }
      } else {
        if (isMultiServerMode) {
          await createServerTaskMutation.mutateAsync({
            serverId: selectedServerId,
            task: values as TaskCreate
          })
        } else {
          await createTaskMutation.mutateAsync(values as TaskCreate)
        }
      }
      setIsModalVisible(false)
      setEditingTask(null)
    } catch (error) {
      console.error('Task operation failed:', error)
    }
  }

  const handleDeleteTask = async (id: number) => {
    try {
      if (isMultiServerMode) {
        await deleteServerTaskMutation.mutateAsync({ serverId: selectedServerId, taskId: id })
      } else {
        await deleteTaskMutation.mutateAsync(id)
      }
    } catch (error) {
      console.error('Delete task failed:', error)
    }
  }

  const handleStartTask = async (id: number) => {
    try {
      if (isMultiServerMode) {
        await startServerTaskMutation.mutateAsync({ serverId: selectedServerId, taskId: id })
      } else {
        await startTaskMutation.mutateAsync(id)
      }
    } catch (error) {
      console.error('Start task failed:', error)
    }
  }

  const handleStopTask = async (id: number) => {
    try {
      if (isMultiServerMode) {
        await stopServerTaskMutation.mutateAsync({ serverId: selectedServerId, taskId: id })
      } else {
        await stopTaskMutation.mutateAsync(id)
      }
    } catch (error) {
      console.error('Stop task failed:', error)
    }
  }

  const handleCancel = () => {
    setIsModalVisible(false)
    setEditingTask(null)
  }

  const runningTasks = tasks?.filter(task => task.status === 'running') || []
  const otherTasks = tasks?.filter(task => task.status !== 'running') || []

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ margin: 0 }}>任务管理</Title>
          <Space>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => refetch()}
              loading={isLoading}
            >
              刷新
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />} 
              onClick={handleCreateTask}
            >
              创建任务
            </Button>
          </Space>
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
                placeholder="选择要管理的服务器"
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

        {/* Running Tasks Alert */}
        {runningTasks.length > 0 && (
          <Alert
            message={`当前有 ${runningTasks.length} 个任务正在运行`}
            type="info"
            showIcon
          />
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <Spin size="large" />
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div>
            {/* Running Tasks */}
            {runningTasks.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <Title level={4} style={{ color: '#52c41a' }}>运行中的任务</Title>
                <Row gutter={[16, 16]}>
                  {runningTasks.map((task) => (
                    <Col xs={24} sm={12} lg={8} xl={6} key={task.id}>
                      <TaskCard
                        task={task}
                        onStart={handleStartTask}
                        onStop={handleStopTask}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        loading={{
                          start: startTaskMutation.isLoading,
                          stop: stopTaskMutation.isLoading,
                          delete: deleteTaskMutation.isLoading,
                        }}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}

            {/* Other Tasks */}
            {otherTasks.length > 0 && (
              <div>
                <Title level={4}>所有任务</Title>
                <Row gutter={[16, 16]}>
                  {otherTasks.map((task) => (
                    <Col xs={24} sm={12} lg={8} xl={6} key={task.id}>
                      <TaskCard
                        task={task}
                        onStart={handleStartTask}
                        onStop={handleStopTask}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        loading={{
                          start: startTaskMutation.isLoading,
                          stop: stopTaskMutation.isLoading,
                          delete: deleteTaskMutation.isLoading,
                        }}
                      />
                    </Col>
                  ))}
                </Row>
              </div>
            )}
          </div>
        ) : (
          <Empty 
            description="暂无任务"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={handleCreateTask}>
              创建第一个任务
            </Button>
          </Empty>
        )}
      </Space>

      {/* Task Form Modal */}
      <Modal
        title={editingTask ? '编辑任务' : '创建任务'}
        open={isModalVisible}
        onCancel={handleCancel}
        footer={null}
        width={600}
        destroyOnHidden={true}
      >
        <TaskForm
          initialValues={editingTask || undefined}
          onSubmit={handleSubmitTask}
          onCancel={handleCancel}
          loading={createTaskMutation.isLoading || updateTaskMutation.isLoading}
          isEdit={!!editingTask}
        />
      </Modal>
    </div>
  )
}

export default TaskManager