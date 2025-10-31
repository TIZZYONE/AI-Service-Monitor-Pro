import { useQuery, useMutation, useQueryClient } from 'react-query'
import { message } from 'antd'
import { logApi } from '../services/api'

// 获取任务日志列表
export const useTaskLogs = (taskId: number) => {
  return useQuery(['taskLogs', taskId], () => logApi.getTaskLogs(taskId), {
    select: (data) => data.data,
    enabled: !!taskId,
    onError: () => {
      message.error('获取任务日志失败')
    },
  })
}

// 获取日志文件内容
export const useLogContent = (taskId: number, logFilePath: string) => {
  return useQuery(
    ['logContent', taskId, logFilePath], 
    () => logApi.getLogContent(taskId, logFilePath),
    {
      select: (data) => data.data,
      enabled: !!taskId && !!logFilePath,
      onError: () => {
        message.error('获取日志内容失败')
      },
    }
  )
}

// 获取任务最新日志内容
export const useLatestLogContent = (taskId: number, enabled: boolean = true) => {
  return useQuery(
    ['latestLogContent', taskId], 
    () => logApi.getLatestLogContent(taskId),
    {
      select: (data) => data.data,
      enabled: !!taskId && enabled,
      refetchInterval: 2000, // 每2秒刷新一次
      onError: () => {
        message.error('获取最新日志内容失败')
      },
    }
  )
}

// 获取所有运行中任务的日志
export const useRunningTasksLogs = () => {
  return useQuery('runningTasksLogs', () => logApi.getRunningTasksLogs(), {
    select: (data) => data.data,
    refetchInterval: 3000, // 每3秒刷新一次
    onError: () => {
      message.error('获取运行中任务日志失败')
    },
  })
}

// 清理旧日志
export const useCleanupLogs = () => {
  const queryClient = useQueryClient()
  
  return useMutation((taskId: number) => logApi.cleanupLogs(taskId), {
    onSuccess: () => {
      message.success('日志清理成功')
      queryClient.invalidateQueries(['taskLogs'])
    },
    onError: () => {
      message.error('日志清理失败')
    },
  })
}