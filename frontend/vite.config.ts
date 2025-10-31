import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function serverConfigFileApi(): Plugin {
  return {
    name: 'server-config-file-api',
    configureServer(server) {
      const dataDir = path.resolve(__dirname, 'data')
      const filePath = path.resolve(dataDir, 'servers.json')

      // ensure data directory and file exist
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true })
      }
      if (!fs.existsSync(filePath)) {
        const initial = [
          {
            id: 'local',
            name: '本地服务器',
            host: 'localhost',
            port: 8633,
            description: '本地开发环境'
          },
        ]
        fs.writeFileSync(filePath, JSON.stringify(initial, null, 2))
      }

      server.middlewares.use('/config/servers', (req, res, next) => {
        if (req.method === 'GET') {
          try {
            const content = fs.readFileSync(filePath, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(content)
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ success: false, message: '读取配置失败' }))
          }
          return
        }

        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '[]')
              if (!Array.isArray(data)) {
                res.statusCode = 400
                res.end(JSON.stringify({ success: false, message: '格式错误，需为数组' }))
                return
              }
              fs.writeFileSync(filePath, JSON.stringify(data, null, 2))
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ success: true }))
            } catch (e) {
              res.statusCode = 400
              res.end(JSON.stringify({ success: false, message: 'JSON解析失败' }))
            }
          })
          return
        }

        next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serverConfigFileApi()],
  server: {
    port: 3456,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8633',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
      },
      '/ws': {
        target: 'ws://127.0.0.1:8633',
        ws: true,
        changeOrigin: true,
      },
    },
  },
})