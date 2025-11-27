import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Button, Typography, Space, message, Modal, Tag, Popover, List, Tooltip, Input, Select, Card, Empty, Skeleton } from 'antd'
import { ThunderboltOutlined, ReloadOutlined, PlusOutlined, CheckSquareOutlined, ExclamationCircleOutlined, DashboardOutlined, HddOutlined, InfoCircleOutlined, SearchOutlined, FilterOutlined } from '@ant-design/icons'
import TaskCard from '../components/TaskCard'
import TaskForm from '../components/TaskForm'
import { Task, TaskCreate, TaskUpdate, Server } from '../types'
import { multiServerApi } from '../services/multiServerApi'
import { serverConfigManager } from '../services/serverConfig'
import { parseGpuUsage } from '../utils/gpu'

const { Title } = Typography
const { Option } = Select

const ServerTaskManager: React.FC = () => {
  const { serverId } = useParams<{ serverId: string }>()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set())
  const [batchStarting, setBatchStarting] = useState(false)
  const [server, setServer] = useState<Server | null>(null)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [repeatTypeFilter, setRepeatTypeFilter] = useState<string>('all')

  const [serverConfigState, setServerConfigState] = useState(serverId ? serverConfigManager.getServer(serverId) : null)

  // 加载服务器信息
  useEffect(() => {
    const loadServerInfo = async () => {
      if (!serverId) return
      try {
        const serverInfo = await multiServerApi.getServerInfo(serverId)
        setServer(serverInfo)
      } catch (error) {
        console.error('Failed to load server info:', error)
        // 加载失败时，保留之前的数据，不做任何更新
        // 这样用户看到的是之前的数据，而不是"已离线"状态
      }
    }

    // 立即加载一次（静默加载，不显示loading状态）
    loadServerInfo()
    
    // 每10秒刷新一次系统信息
    const interval = setInterval(() => {
      loadServerInfo()
    }, 10000)

    return () => {
      clearInterval(interval)
    }
  }, [serverId])

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

  const handleStartAll = () => {
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

    // 显示确认弹窗
    Modal.confirm({
      title: '确认启动任务',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>确定要启动以下 {tasksToStart.length} 个任务吗？</p>
          <ul style={{ marginTop: 8, paddingLeft: 20, maxHeight: 200, overflowY: 'auto' }}>
            {tasksToStart.map(task => (
              <li key={task.id} style={{ marginBottom: 4 }}>
                <span style={{ fontWeight: 500 }}>{task.name}</span>
                <span style={{ color: '#999', marginLeft: 8 }}>(ID: {task.id})</span>
              </li>
            ))}
          </ul>
        </div>
      ),
      okText: '确认启动',
      cancelText: '取消',
      okType: 'primary',
      onOk: async () => {
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
    })
  }

  // 过滤任务
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // 搜索关键词过滤
      if (searchKeyword) {
        const keyword = searchKeyword.toLowerCase()
        const matchName = task.name.toLowerCase().includes(keyword)
        const matchCommand = task.activate_env_command.toLowerCase().includes(keyword) ||
                           task.main_program_command.toLowerCase().includes(keyword)
        if (!matchName && !matchCommand) {
          return false
        }
      }

      // 状态过滤
      if (statusFilter !== 'all' && task.status !== statusFilter) {
        return false
      }

      // 重复类型过滤
      if (repeatTypeFilter !== 'all' && task.repeat_type !== repeatTypeFilter) {
        return false
      }

      return true
    })
  }, [tasks, searchKeyword, statusFilter, repeatTypeFilter])

  return (
    <div style={{ padding: 0 }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 16,
          marginBottom: 16 
        }}>
          <Title level={3} style={{ margin: 0, color: '#0f172a', fontWeight: 600 }}>
            {serverConfigState.name} · 任务管理
          </Title>
          {/* 服务器信息 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {server && server.system ? (
              <>
                <Tooltip
                  title={
                    <div>
                      <div>CPU使用率: {server.system?.cpu_usage || 'N/A'}</div>
                      {server.system?.cpu_count_physical && (
                        <div>物理核心: {server.system.cpu_count_physical}核</div>
                      )}
                      {server.system?.cpu_count_logical && (
                        <div>逻辑核心: {server.system.cpu_count_logical}核</div>
                      )}
                      {server.system?.cpu_freq_current_mhz != null && (
                        <div>当前频率: {server.system.cpu_freq_current_mhz.toFixed(2)} MHz</div>
                      )}
                      {server.system?.cpu_freq_max_mhz != null && (
                        <div>最大频率: {server.system.cpu_freq_max_mhz.toFixed(2)} MHz</div>
                      )}
                    </div>
                  }
                >
                  <Tag style={{ 
                    background: '#ecfdf5', 
                    borderColor: '#d1fae5', 
                    color: '#065f46', 
                    borderRadius: 16, 
                    padding: '4px 12px', 
                    fontSize: 12, 
                    cursor: 'help',
                    margin: 0
                  }}>
                    <DashboardOutlined style={{ marginRight: 6 }} />
                    CPU {server.system?.cpu_usage || 'N/A'}
                    {server.system?.cpu_count_logical && ` (${server.system.cpu_count_logical}核)`}
                  </Tag>
                </Tooltip>
                <Tag style={{ 
                  background: '#eff6ff', 
                  borderColor: '#dbeafe', 
                  color: '#1e3a8a', 
                  borderRadius: 16, 
                  padding: '4px 12px', 
                  fontSize: 12,
                  margin: 0
                }}>
                  <DashboardOutlined style={{ marginRight: 6 }} />
                  内存 {server.system.memory_usage}
                  {server.system.memory_total ? ` / ${server.system.memory_total}` : ''}
                </Tag>
                <Tag style={{ 
                  background: '#f5f3ff', 
                  borderColor: '#ede9fe', 
                  color: '#5b21b6', 
                  borderRadius: 16, 
                  padding: '4px 12px', 
                  fontSize: 12,
                  margin: 0
                }}>
                  <HddOutlined style={{ marginRight: 6 }} />
                  磁盘 {server.system.disk_usage}
                  {server.system.disk_total ? ` / ${server.system.disk_total}` : ''}
                </Tag>
                {server.system.gpu_memory_usage && (
                  (() => {
                    const structured = server.system.gpus && server.system.gpus.length > 0
                    const g = structured 
                      ? {
                          totalGB: (server.system.gpus!.reduce((acc, c) => acc + (c.memory_total_mb || 0), 0)) / 1024,
                          averagePercent: server.system.gpu_percent_avg ?? undefined,
                          cards: server.system.gpus!.map((c) => ({
                            index: c.index,
                            usedGB: c.memory_used_mb !== undefined ? c.memory_used_mb / 1024 : undefined,
                            totalGB: c.memory_total_mb !== undefined ? c.memory_total_mb / 1024 : undefined,
                            percent: c.percent
                          }))
                        }
                      : parseGpuUsage(server.system.gpu_memory_usage, server.system.gpu_memory_total)
                    const average = g.averagePercent !== undefined ? `${g.averagePercent.toFixed(1)}%` : server.system.gpu_memory_usage
                    const total = g.totalGB !== undefined ? `${g.totalGB.toFixed(2)}GB` : (server.system.gpu_memory_total || '')
                    const content = g.cards.length > 0 ? (
                      <div style={{ minWidth: 320, maxWidth: 500 }}>
                        {server.system?.gpu_driver_version && (
                          <div style={{ padding: '8px 12px', borderBottom: '1px solid #e5e7eb', marginBottom: 8 }}>
                            <div style={{ fontSize: 12, color: '#64748b' }}>驱动版本: <span style={{ fontWeight: 500, color: '#0f172a' }}>{server.system.gpu_driver_version}</span></div>
                          </div>
                        )}
                        <List
                          size="small"
                          dataSource={g.cards}
                          renderItem={(item: any) => {
                            const card = server.system?.gpus?.find((gpu: any) => gpu.index === item.index)
                            return (
                              <List.Item style={{ padding: '12px', borderBottom: '1px solid #f3f4f6' }}>
                                <div style={{ width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>GPU {item.index}</span>
                                    {card?.name && (
                                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>{card.name}</span>
                                    )}
                                  </div>
                                  <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span>显存:</span>
                                      <span style={{ fontWeight: 500 }}>
                                        {item.usedGB !== undefined && item.totalGB !== undefined
                                          ? `${item.usedGB.toFixed(2)}GB / ${item.totalGB.toFixed(2)}GB`
                                          : 'N/A'}
                                        {item.percent !== undefined ? ` (${item.percent.toFixed(1)}%)` : ''}
                                      </span>
                                    </div>
                                    {card?.utilization_percent != null && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>GPU利用率:</span>
                                        <span style={{ fontWeight: 500 }}>{card.utilization_percent.toFixed(1)}%</span>
                                      </div>
                                    )}
                                    {card?.temperature_celsius != null && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>温度:</span>
                                        <span style={{ fontWeight: 500, color: card.temperature_celsius > 80 ? '#dc2626' : card.temperature_celsius > 70 ? '#f59e0b' : '#059669' }}>
                                          {card.temperature_celsius.toFixed(1)}°C
                                        </span>
                                      </div>
                                    )}
                                    {card?.power_draw_watts != null && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>功耗:</span>
                                        <span style={{ fontWeight: 500 }}>{card.power_draw_watts.toFixed(1)}W</span>
                                      </div>
                                    )}
                                    {card?.memory_clock_mhz != null && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>显存频率:</span>
                                        <span style={{ fontWeight: 500 }}>{card.memory_clock_mhz.toFixed(0)} MHz</span>
                                      </div>
                                    )}
                                    {card?.graphics_clock_mhz != null && (
                                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span>核心频率:</span>
                                        <span style={{ fontWeight: 500 }}>{card.graphics_clock_mhz.toFixed(0)} MHz</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </List.Item>
                            )
                          }}
                          style={{ maxHeight: 400, overflowY: 'auto' }}
                        />
                      </div>
                    ) : (
                      <div style={{ padding: 8, color: '#64748b' }}>当前后端未提供逐卡数据</div>
                    )

                    return (
                      <Popover content={content} placement="bottomRight" trigger="click">
                        <Tag style={{ 
                          background: '#fff7ed', 
                          borderColor: '#ffedd5', 
                          color: '#9a3412', 
                          borderRadius: 16, 
                          padding: '4px 12px', 
                          fontSize: 12, 
                          cursor: 'pointer',
                          margin: 0
                        }}>
                          <ThunderboltOutlined style={{ marginRight: 6 }} />
                          显存 总计 {total} · 平均使用率 {average}
                          <InfoCircleOutlined style={{ marginLeft: 6 }} />
                        </Tag>
                      </Popover>
                    )
                  })()
                )}
              </>
            ) : null}
          </div>
        </div>
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

      {/* 搜索和筛选栏 */}
      <Card 
        style={{ 
          marginBottom: 16, 
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
        bodyStyle={{ padding: '16px' }}
      >
        <Space wrap style={{ width: '100%' }} size="middle">
          <Input
            placeholder="搜索任务名称或命令..."
            prefix={<SearchOutlined style={{ color: '#999' }} />}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            allowClear
            style={{ width: 300 }}
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            suffixIcon={<FilterOutlined />}
          >
            <Option value="all">全部状态</Option>
            <Option value="running">运行中</Option>
            <Option value="stopped">已停止</Option>
            <Option value="pending">等待中</Option>
            <Option value="error">错误</Option>
          </Select>
          <Select
            placeholder="重复类型"
            value={repeatTypeFilter}
            onChange={setRepeatTypeFilter}
            style={{ width: 120 }}
          >
            <Option value="all">全部类型</Option>
            <Option value="none">仅一次</Option>
            <Option value="daily">每日</Option>
            <Option value="weekly">每周</Option>
            <Option value="monthly">每月</Option>
          </Select>
          {(searchKeyword || statusFilter !== 'all' || repeatTypeFilter !== 'all') && (
            <Button 
              type="text" 
              onClick={() => {
                setSearchKeyword('')
                setStatusFilter('all')
                setRepeatTypeFilter('all')
              }}
            >
              清除筛选
            </Button>
          )}
          <div style={{ flex: 1, textAlign: 'right', color: '#999', fontSize: 14 }}>
            共 {filteredTasks.length} 个任务
          </div>
        </Space>
      </Card>

      {/* 任务列表 */}
      {loading && tasks.length === 0 ? (
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {[1, 2, 3].map(i => (
            <Card key={i} style={{ borderRadius: 12 }}>
              <Skeleton active paragraph={{ rows: 4 }} />
            </Card>
          ))}
        </div>
      ) : (
        <>
          {filteredTasks.length === 0 ? (
            <Card style={{ borderRadius: 12 }}>
              <Empty
                description={
                  tasks.length === 0 
                    ? '暂无任务，点击"创建任务"开始添加'
                    : '没有找到匹配的任务'
                }
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                {tasks.length === 0 && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateTask}>
                    创建任务
                  </Button>
                )}
              </Empty>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  serverId={serverId}
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
          )}
        </>
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
