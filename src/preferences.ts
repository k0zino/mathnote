import { cloneToolStyles, type ToolStyle } from './ink/brushes'
import type { StrokeTool } from './ink/types'
import type { PaperMode } from './notebook'

export interface RecentDocument {
  path: string
  name: string
  pageCount: number
  orientation: PaperMode
  updatedAt: number
}

export interface AppPreferences {
  themeColor: string
  animations: boolean
  brushes: Record<StrokeTool, ToolStyle>
  recents: RecentDocument[]
}

const STORAGE_KEY = 'mathnote.preferences.v1'
export const DEFAULT_THEME = '#3b64dc'
const MAX_RECENTS = 12

export function defaultPreferences(): AppPreferences {
  return {
    themeColor: DEFAULT_THEME,
    animations: true,
    brushes: cloneToolStyles(),
    recents: [],
  }
}

function isValidCurve(value: unknown): value is [number, number, number] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((item) => typeof item === 'number' && Number.isFinite(item))
  )
}

export function loadPreferences(): AppPreferences {
  const defaults = defaultPreferences()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaults
    const parsed = JSON.parse(raw) as Partial<AppPreferences>

    const brushes = cloneToolStyles()
    for (const tool of Object.keys(brushes) as StrokeTool[]) {
      const saved = parsed.brushes?.[tool]
      if (!saved) continue
      if (typeof saved.color === 'string') brushes[tool].color = saved.color
      if (typeof saved.size === 'number' && Number.isFinite(saved.size)) {
        brushes[tool].size = Math.min(3, Math.max(0.4, saved.size))
      }
      if (isValidCurve(saved.curve)) brushes[tool].curve = saved.curve
    }

    const recents = Array.isArray(parsed.recents)
      ? parsed.recents.filter(
          (item): item is RecentDocument =>
            Boolean(item) &&
            typeof item.path === 'string' &&
            typeof item.name === 'string' &&
            typeof item.updatedAt === 'number',
        )
      : []

    return {
      themeColor:
        typeof parsed.themeColor === 'string' ? parsed.themeColor : defaults.themeColor,
      animations:
        typeof parsed.animations === 'boolean' ? parsed.animations : defaults.animations,
      brushes,
      recents: recents.slice(0, MAX_RECENTS),
    }
  } catch {
    return defaults
  }
}

export function savePreferences(preferences: AppPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // 存储不可用时保持内存状态
  }
}

export function addRecent(
  recents: RecentDocument[],
  entry: RecentDocument,
): RecentDocument[] {
  return [entry, ...recents.filter((item) => item.path !== entry.path)].slice(
    0,
    MAX_RECENTS,
  )
}

export function removeRecent(recents: RecentDocument[], path: string): RecentDocument[] {
  return recents.filter((item) => item.path !== path)
}

export function formatRelativeTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startOfDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime()
  const days = Math.round((startOfToday - startOfDate) / 86_400_000)

  if (days <= 0) {
    return `今天 ${date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })}`
  }
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'numeric', day: 'numeric' })
}
