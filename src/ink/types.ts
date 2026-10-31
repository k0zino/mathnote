export type Tool = StrokeTool | 'lasso' | 'select' | 'eraser'

export type StrokeTool = 'pen' | 'ballpoint' | 'fountain' | 'highlighter'

export function isWritingTool(tool: Tool): tool is StrokeTool {
  return tool === 'pen' || tool === 'ballpoint' || tool === 'fountain' || tool === 'highlighter'
}

/** 25% / 50% / 75% 压力处的宽度比例 */
export type PressureCurve = [number, number, number]

export interface Point {
  x: number
  y: number
  /** 压感 0..1 */
  p: number
  /** 事件时间戳（performance timeline） */
  t: number
}

export interface Stroke {
  points: Point[]
  color: string
  /** 线宽倍率，1 为默认 */
  size: number
  tool: StrokeTool
  /** 落笔时的压感曲线，保证旧笔记重绘结果稳定 */
  curve?: PressureCurve
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Selection {
  rect: Rect
  /** 套索轮廓（文档坐标）；矩形框选时为 undefined */
  polygon?: Point[]
}
