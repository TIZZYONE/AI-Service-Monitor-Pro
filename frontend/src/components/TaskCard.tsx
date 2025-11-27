import React, { useState } from 'react'
import { Card, Tag, Button, Space, Popconfirm, Typography, Tooltip, Checkbox, Collapse, message } from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  CaretRightOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { Task } from '../types'

const { Text, Paragraph } = Typography
const { Panel } = Collapse

interface TaskCardProps {
  task: Task
  serverId?: string
  onStart: (id: number) => void
  onStop: (id: number) => void
  onEdit: (task: Task) => void
  onDelete: (id: number) => void
  loading?: {
    start?: boolean
    stop?: boolean
    delete?: boolean
  }
  selected?: boolean
  onSelectChange?: (id: number, selected: boolean) => void
  showCheckbox?: boolean
}

const TaskCard: React.FC<TaskCardProps> = ({
  task,
  serverId,
  onStart,
  onStop,
  onEdit,
  onDelete,
  loading = {},
  selected = false,
  onSelectChange,
  showCheckbox = false,
}) => {
  const navigate = useNavigate()
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])

  // 复制命令到剪贴板
  const copyCommand = async (command: string, commandName: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(command)
      message.success(`${commandName}已复制到剪贴板`)
    } catch (error) {
      message.error('复制失败')
      console.error('复制失败:', error)
    }
  }

  const getStatusTag = (status: string) => {
    const statusConfig = {
      running: { color: 'green', text: '运行中' },
      stopped: { color: 'red', text: '已停止' },
      pending: { color: 'orange', text: '等待中' },
      error: { color: 'red', text: '错误' },
    }
    
    const config = statusConfig[status as keyof typeof statusConfig] || { color: 'default', text: status }
    return <Tag color={config.color}>{config.text}</Tag>
  }

  const getRepeatTypeText = (type: string) => {
    const typeMap = {
      none: '仅一次',
      daily: '每日',
      weekly: '每周',
      monthly: '每月',
      quarterly: '每季度',
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  const getRepeatTypeColor = (type: string) => {
    const colorMap = {
      none: 'default',      // 仅一次 - 灰色
      daily: 'blue',        // 每日 - 蓝色
      weekly: 'green',      // 每周 - 绿色
      monthly: 'orange',    // 每月 - 橙色
      quarterly: 'purple',  // 每季度 - 紫色
    }
    return colorMap[type as keyof typeof colorMap] || 'default'
  }

  const canStart = task.status === 'stopped' || task.status === 'pending' || task.status === 'error'
  const canStop = task.status === 'running'

  const handleCardClick = (e: React.MouseEvent) => {
    // 如果点击的是按钮、复选框或其他交互元素，不跳转
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('.ant-checkbox') ||
      target.closest('.ant-checkbox-wrapper') ||
      target.closest('.ant-popconfirm') ||
      target.closest('.ant-collapse')
    ) {
      return
    }
    
    // 跳转到日志查看页面
    if (serverId) {
      navigate(`/servers/${serverId}/logs?taskId=${task.id}`)
    }
  }

  return (
    <Card
      className="task-card"
      style={{ 
        cursor: serverId ? 'pointer' : 'default',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'all 0.3s ease',
        height: '100%',
        maxHeight: '500px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
      onClick={handleCardClick}
      onMouseEnter={(e) => {
        if (serverId) {
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 163, 127, 0.12)'
          e.currentTarget.style.transform = 'translateY(-2px)'
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
      bodyStyle={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        padding: '16px',
        overflow: 'hidden'
      }}
      title={
        <Space>
          {showCheckbox && (
            <Checkbox
              checked={selected}
              onChange={(e) => onSelectChange?.(task.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <Text strong>{task.name}</Text>
          {getStatusTag(task.status)}
        </Space>
      }
      extra={
        <Space>
          {canStart && (
            <Tooltip title="启动任务">
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                size="small"
                loading={loading.start}
                onClick={() => onStart(task.id)}
              />
            </Tooltip>
          )}
          {canStop && (
            <Tooltip title="停止任务">
              <Button
                danger
                icon={<PauseCircleOutlined />}
                size="small"
                loading={loading.stop}
                onClick={() => onStop(task.id)}
              />
            </Tooltip>
          )}
          <Tooltip title="编辑任务">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => onEdit(task)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个任务吗？"
            onConfirm={() => onDelete(task.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除任务">
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={loading.delete}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      }
    >
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        overflow: 'hidden'
      }}>
        {/* 基本信息区域 */}
        <div style={{ marginBottom: 12 }}>
          <Space wrap style={{ width: '100%' }}>
            <Tag color={getRepeatTypeColor(task.repeat_type)} style={{ margin: 0 }}>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              {getRepeatTypeText(task.repeat_type)}
            </Tag>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              开始：{dayjs(task.start_time).format('MM-DD HH:mm')}
            </Text>
            {task.end_time && (
              <Text type="secondary" style={{ fontSize: '12px' }}>
                结束：{dayjs(task.end_time).format('MM-DD HH:mm')}
              </Text>
            )}
          </Space>
        </div>

        {/* 命令区域 - 可折叠 */}
        <div style={{ flex: 1, overflow: 'auto', marginBottom: 12, minHeight: 0 }}>
          <Collapse
            ghost
            activeKey={expandedKeys}
            onChange={setExpandedKeys}
            expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} style={{ fontSize: '16px', color: '#666' }} />}
            style={{ background: 'transparent' }}
          >
            <Panel 
              header={
                <div 
                  onClick={(e) => {
                    e.stopPropagation()
                    copyCommand(task.activate_env_command, '激活命令', e)
                  }}
                  style={{ 
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'inline-block'
                  }}
                >
                  <Text 
                    type="secondary" 
                    style={{ 
                      fontSize: '12px', 
                      fontWeight: 500
                    }}
                  >
                    <CodeOutlined style={{ marginRight: 4 }} />
                    激活命令
                  </Text>
                </div>
              } 
              key="activate"
              style={{ 
                padding: 0,
                border: 'none'
              }}
            >
              <Paragraph 
                code 
                copyable 
                style={{ 
                  margin: 0, 
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  background: '#f5f5f5',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '80px',
                  overflow: 'auto',
                  lineHeight: '1.5'
                }}
              >
                {task.activate_env_command}
              </Paragraph>
            </Panel>
            
            <Panel 
              header={
                <div 
                  onClick={(e) => {
                    e.stopPropagation()
                    copyCommand(task.main_program_command, '主程序命令', e)
                  }}
                  style={{ 
                    cursor: 'pointer',
                    userSelect: 'none',
                    display: 'inline-block'
                  }}
                >
                  <Text 
                    type="secondary" 
                    style={{ 
                      fontSize: '12px', 
                      fontWeight: 500
                    }}
                  >
                    <CodeOutlined style={{ marginRight: 4 }} />
                    主程序命令
                  </Text>
                </div>
              } 
              key="main"
              style={{ 
                padding: 0,
                border: 'none'
              }}
            >
              <Paragraph 
                code 
                copyable 
                style={{ 
                  margin: 0, 
                  fontSize: '12px',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  background: '#f5f5f5',
                  padding: '8px',
                  borderRadius: '4px',
                  maxHeight: '120px',
                  overflow: 'auto',
                  lineHeight: '1.5'
                }}
              >
                {task.main_program_command}
              </Paragraph>
            </Panel>
          </Collapse>
        </div>

        {/* 底部信息 */}
        <div style={{ 
          marginTop: 'auto',
          paddingTop: 12,
          borderTop: '1px solid #f0f0f0'
        }}>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            创建于 {dayjs(task.created_at).format('YYYY-MM-DD HH:mm')}
          </Text>
        </div>
      </div>
    </Card>
  )
}

export default TaskCard