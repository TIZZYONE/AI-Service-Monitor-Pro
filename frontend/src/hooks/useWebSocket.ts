import { useEffect, useRef, useState } from 'react'
import { message } from 'antd'

interface UseWebSocketOptions {
  onMessage?: (data: any) => void
  onError?: (error: Event) => void
  onOpen?: () => void
  onClose?: () => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export const useWebSocket = (url: string | null, options: UseWebSocketOptions = {}) => {
  const {
    onMessage,
    onError,
    onOpen,
    onClose,
    reconnectInterval = 3000,
    maxReconnectAttempts = 5
  } = options

  const [isConnected, setIsConnected] = useState(false)
  const [reconnectCount, setReconnectCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectCountRef = useRef(0) // 使用 ref 跟踪重连次数，避免闭包问题
  const shouldReconnectRef = useRef(true) // 控制是否应该重连
  const currentUrlRef = useRef<string | null>(null)

  const connect = () => {
    if (!url) {
      return
    }
    
    // 如果已经有连接且URL相同，不重复连接
    if (wsRef.current && currentUrlRef.current === url && wsRef.current.readyState === WebSocket.OPEN) {
      return
    }

    // 清除之前的连接
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    try {
      const ws = new WebSocket(url)
      wsRef.current = ws
      currentUrlRef.current = url

      ws.onopen = () => {
        setIsConnected(true)
        reconnectCountRef.current = 0
        setReconnectCount(0)
        shouldReconnectRef.current = true
        console.log('WebSocket connected:', url)
        onOpen?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          onMessage?.(data)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        onError?.(error)
      }

      ws.onclose = (event) => {
        setIsConnected(false)
        console.log('WebSocket closed:', event.code, event.reason)
        onClose?.()

        // 只有在应该重连且URL没有变化时才重连
        if (shouldReconnectRef.current && currentUrlRef.current === url && reconnectCountRef.current < maxReconnectAttempts) {
          reconnectCountRef.current += 1
          setReconnectCount(reconnectCountRef.current)
          console.log(`Attempting to reconnect (${reconnectCountRef.current}/${maxReconnectAttempts})...`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current && currentUrlRef.current === url) {
              connect()
            }
          }, reconnectInterval)
        } else if (reconnectCountRef.current >= maxReconnectAttempts) {
          console.error('WebSocket连接失败，已达到最大重连次数')
          message.error('WebSocket连接失败，请刷新页面重试')
        }
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setIsConnected(false)
    }
  }

  const disconnect = () => {
    shouldReconnectRef.current = false // 停止重连
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
    reconnectCountRef.current = 0
    setReconnectCount(0)
  }

  const sendMessage = (data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  useEffect(() => {
    // URL变化时重置重连计数
    if (currentUrlRef.current !== url) {
      reconnectCountRef.current = 0
      setReconnectCount(0)
      shouldReconnectRef.current = true
    }

    if (url) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [url])

  return {
    isConnected,
    sendMessage,
    disconnect,
    reconnect: connect,
    reconnectCount
  }
}

export default useWebSocket