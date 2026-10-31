import type { PressureCurve, StrokeTool } from './types'

export interface ToolStyle {
  color: string
  size: number
  /** 在 25% / 50% / 75% 压力处的宽度比例，端点为 0 和 1 */
  curve: PressureCurve
}

export const DEFAULT_TOOL_STYLES: Record<StrokeTool, ToolStyle> = {
  pen: { color: '#23262b', size: 1, curve: [0.41, 0.64, 0.83] },
  ballpoint: { color: '#23262b', size: 0.9, curve: [0.25, 0.5, 0.75] },
  fountain: { color: '#1f2a44', size: 1.2, curve: [0.14, 0.38, 0.67] },
  highlighter: { color: '#f5c542', size: 1, curve: [0.25, 0.5, 0.75] },
}

export function cloneToolStyles(): Record<StrokeTool, ToolStyle> {
  return {
    pen: { ...DEFAULT_TOOL_STYLES.pen, curve: [...DEFAULT_TOOL_STYLES.pen.curve] },
    ballpoint: {
      ...DEFAULT_TOOL_STYLES.ballpoint,
      curve: [...DEFAULT_TOOL_STYLES.ballpoint.curve],
    },
    fountain: {
      ...DEFAULT_TOOL_STYLES.fountain,
      curve: [...DEFAULT_TOOL_STYLES.fountain.curve],
    },
    highlighter: {
      ...DEFAULT_TOOL_STYLES.highlighter,
      curve: [...DEFAULT_TOOL_STYLES.highlighter.curve],
    },
  }
}
