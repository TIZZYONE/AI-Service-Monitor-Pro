import React from 'react'
import { Card, Tag, Button, Space, Popconfirm, Typography, Tooltip, Checkbox } from 'antd'
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ClockCircleOutlined,
  CodeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { Task } from '../types'

const { Text, Paragraph } = Typography

interface TaskCardProps {
  task: Task
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
  onStart,
  onStop,
  onEdit,
  onDelete,
  loading = {},
  selected = false,
  onSelectChange,
  showCheckbox = false,
}) => {
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
    }
    return typeMap[type as keyof typeof typeMap] || type
  }

  const canStart = task.status === 'stopped' || task.status === 'pending' || task.status === 'error'
  const canStop = task.status === 'running'

  return (
    <Card
      className="task-card"
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
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text type="secondary">
            <CodeOutlined /> 激活命令：
          </Text>
          <Paragraph 
            code 
            copyable 
            style={{ margin: '4px 0', fontSize: '12px' }}
          >
            {task.activate_env_command}
          </Paragraph>
        </div>
        
        <div>
          <Text type="secondary">
            <CodeOutlined /> 主程序命令：
          </Text>
          <Paragraph 
            code 
            copyable 
            style={{ margin: '4px 0', fontSize: '12px' }}
          >
            {task.main_program_command}
          </Paragraph>
        </div>

        <Space wrap>
          <Text type="secondary">
            <ClockCircleOutlined /> 重复类型：{getRepeatTypeText(task.repeat_type)}
          </Text>
          <Text type="secondary">
            开始时间：{dayjs(task.start_time).format('YYYY-MM-DD HH:mm:ss')}
          </Text>
          {task.end_time && (
            <Text type="secondary">
              结束时间：{dayjs(task.end_time).format('YYYY-MM-DD HH:mm:ss')}
            </Text>
          )}
        </Space>

        <Text type="secondary" style={{ fontSize: '12px' }}>
          创建时间：{dayjs(task.created_at).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      </Space>
    </Card>
  )
}

export default TaskCard