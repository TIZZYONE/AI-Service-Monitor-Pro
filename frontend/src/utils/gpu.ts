export interface GpuCardInfo {
  index: number
  usedGB?: number
  totalGB?: number
  percent?: number
}

export interface GpuSummary {
  totalGB?: number
  averagePercent?: number
  cards: GpuCardInfo[]
}

// 将后端返回的字符串进行容错解析，支持以下格式：
// 1) "85.8% / 140GB"（汇总）
// 2) "GPU0: 10GB/20GB (50%), GPU1: 8GB/20GB (40%)"（逐卡）
// 3) "10GB/20GB, 8GB/20GB, ..."（逐卡）
// 4) "50%, 40%, ..."（逐卡百分比）
export function parseGpuUsage(rawUsage?: string, rawTotal?: string): GpuSummary {
  const summary: GpuSummary = { cards: [] }

  if (!rawUsage && !rawTotal) return summary

  const normalizeGB = (text?: string): number | undefined => {
    if (!text) return undefined
    const m = text.trim().match(/([0-9]+(?:\.[0-9]+)?)\s*(?:GB|G)/i)
    return m ? parseFloat(m[1]) : undefined
  }

  const normalizePercent = (text?: string): number | undefined => {
    if (!text) return undefined
    const m = text.trim().match(/([0-9]+(?:\.[0-9]+)?)\s*%/)
    return m ? parseFloat(m[1]) : undefined
  }

  // 尝试解析逐卡：按照逗号分割
  const tokens = rawUsage?.split(/[,;]+/).map(t => t.trim()).filter(Boolean) || []
  if (tokens.length > 1) {
    tokens.forEach((tok, idx) => {
      // 优先匹配 "10GB/20GB (50%)" 或 "GPU0: 10GB/20GB (50%)"
      const m = tok.match(/([0-9]+(?:\.[0-9]+)?)\s*(?:GB|G)\s*\/\s*([0-9]+(?:\.[0-9]+)?)\s*(?:GB|G)(?:[^0-9]+([0-9]+(?:\.[0-9]+)?))?/) 
      if (m) {
        const used = parseFloat(m[1])
        const total = parseFloat(m[2])
        const percent = m[3] ? parseFloat(m[3]) : (total ? (used / total) * 100 : undefined)
        summary.cards.push({ index: idx, usedGB: used, totalGB: total, percent })
        return
      }

      // 次选匹配百分比："50%"
      const p = normalizePercent(tok)
      if (p !== undefined) {
        summary.cards.push({ index: idx, percent: p })
      }
    })
  }

  // 如果逐卡已解析出有效数据，计算汇总
  if (summary.cards.length > 0) {
    const total = summary.cards.reduce((acc, c) => acc + (c.totalGB || 0), 0)
    const used = summary.cards.reduce((acc, c) => acc + (c.usedGB || (c.percent && c.totalGB ? (c.percent / 100) * c.totalGB : 0)), 0)
    summary.totalGB = total || normalizeGB(rawTotal)
    summary.averagePercent = total ? (used / total) * 100 : normalizePercent(rawUsage)
    return summary
  }

  // 否则作为汇总数据处理
  summary.totalGB = normalizeGB(rawTotal)
  summary.averagePercent = normalizePercent(rawUsage)
  return summary
}