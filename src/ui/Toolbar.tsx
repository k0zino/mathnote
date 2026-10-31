import {
  Eraser,
  Highlighter,
  Lasso,
  Pen,
  PenLine,
  PenTool,
  SquareDashed,
  Trash,
  Undo2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DEFAULT_TOOL_STYLES, type ToolStyle } from '../ink/brushes'
import { isWritingTool, type PressureCurve, type StrokeTool, type Tool } from '../ink/types'

const PEN_COLORS = ['#23262b', '#3b64dc', '#d1483b', '#2f8f5b', '#e8a33d']
const HIGHLIGHTER_COLORS = ['#f5c542', '#5ecb8a', '#5aa9f5', '#f27ea9', '#b07cf0']

const TOOL_LABELS: Record<StrokeTool, string> = {
  pen: '压感笔',
  ballpoint: '圆珠笔',
  fountain: '钢笔',
  highlighter: '荧光笔',
}

const TOOLS: { id: Tool; title: string; icon: typeof Pen }[] = [
  { id: 'pen', title: '压感笔 (P)', icon: Pen },
  { id: 'ballpoint', title: '圆珠笔 (B)', icon: PenLine },
  { id: 'fountain', title: '钢笔 (F)', icon: PenTool },
  { id: 'highlighter', title: '荧光笔 (H)', icon: Highlighter },
  { id: 'eraser', title: '橡皮 (E)', icon: Eraser },
  { id: 'select', title: '框选，选中后自动附加到 AI (S)', icon: SquareDashed },
  { id: 'lasso', title: '圈选，按轮廓附加到 AI (L)', icon: Lasso },
]

interface ToolbarProps {
  tool: Tool
  onToolChange: (tool: Tool) => void
  styles: Record<StrokeTool, ToolStyle>
  onStyleChange: (tool: StrokeTool, patch: Partial<ToolStyle>) => void
  eraserRadius: number
  onEraserRadiusChange: (radius: number) => void
  barrelEraser: boolean
  onBarrelEraserChange: (enabled: boolean) => void
  onUndo: () => void
  onClear: () => void
}

interface StylePopoverProps {
  tool: StrokeTool
  style: ToolStyle
  align: 'left' | 'right'
  onChange: (patch: Partial<ToolStyle>) => void
}

const CURVE_WIDTH = 220
const CURVE_HEIGHT = 92
const CURVE_PAD = 10

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

function PressureCurveEditor({
  tool,
  curve,
  onChange,
}: {
  tool: StrokeTool
  curve: PressureCurve
  onChange: (curve: PressureCurve) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<number | null>(null)

  const xAt = (index: number) =>
    CURVE_PAD + ((index + 1) / 4) * (CURVE_WIDTH - CURVE_PAD * 2)
  const yAt = (value: number) =>
    CURVE_HEIGHT - CURVE_PAD - value * (CURVE_HEIGHT - CURVE_PAD * 2)

  const valueFromY = (clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return 0
    return clamp01(1 - (clientY - rect.top - CURVE_PAD) / (CURVE_HEIGHT - CURVE_PAD * 2))
  }

  const indexFromX = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return 1
    const ratio = (clientX - rect.left - CURVE_PAD) / (CURVE_WIDTH - CURVE_PAD * 2)
    return Math.min(2, Math.max(0, Math.round(ratio * 4) - 1))
  }

  const apply = (clientY: number, index: number) => {
    const next = [...curve] as PressureCurve
    next[index] = valueFromY(clientY)
    onChange(next)
  }

  const points = [
    [0, 0],
    [0.25, curve[0]],
    [0.5, curve[1]],
    [0.75, curve[2]],
    [1, 1],
  ]

  return (
    <div className="curve-editor">
      <div className="curve-head">
        <span className="popover-label">压感曲线</span>
        <button
          className="curve-reset"
          onClick={() => onChange([...DEFAULT_TOOL_STYLES[tool].curve] as PressureCurve)}
        >
          重置
        </button>
      </div>

      <svg
        ref={svgRef}
        className="curve-svg"
        viewBox={`0 0 ${CURVE_WIDTH} ${CURVE_HEIGHT}`}
        onPointerDown={(event) => {
          const index = indexFromX(event.clientX)
          setDrag(index)
          event.currentTarget.setPointerCapture(event.pointerId)
          apply(event.clientY, index)
        }}
        onPointerMove={(event) => {
          if (drag === null) return
          apply(event.clientY, drag)
        }}
        onPointerUp={() => setDrag(null)}
        onPointerCancel={() => setDrag(null)}
      >
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={`v${ratio}`}
            x1={CURVE_PAD + ratio * (CURVE_WIDTH - CURVE_PAD * 2)}
            y1={CURVE_PAD}
            x2={CURVE_PAD + ratio * (CURVE_WIDTH - CURVE_PAD * 2)}
            y2={CURVE_HEIGHT - CURVE_PAD}
            className="curve-grid"
          />
        ))}
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={`h${ratio}`}
            x1={CURVE_PAD}
            y1={CURVE_PAD + (1 - ratio) * (CURVE_HEIGHT - CURVE_PAD * 2)}
            x2={CURVE_WIDTH - CURVE_PAD}
            y2={CURVE_PAD + (1 - ratio) * (CURVE_HEIGHT - CURVE_PAD * 2)}
            className="curve-grid"
          />
        ))}

        <polyline
          className="curve-line"
          points={points.map(([x, y]) => `${xAt(x)},${yAt(y)}`).join(' ')}
        />

        {points.slice(1, -1).map(([x, y], index) => (
          <circle
            key={index}
            className={`curve-point ${drag === index ? 'active' : ''}`}
            cx={xAt(x)}
            cy={yAt(y)}
            r={drag === index ? 6 : 4.5}
          />
        ))}
      </svg>

      <div className="curve-axis">
        <span>轻压</span>
        <span>重压</span>
      </div>
    </div>
  )
}

function StylePopover({ tool, style, align, onChange }: StylePopoverProps) {
  const isHighlighter = tool === 'highlighter'
  const colors = isHighlighter ? HIGHLIGHTER_COLORS : PEN_COLORS
  const min = isHighlighter ? 0.5 : 0.4
  const max = isHighlighter ? 2 : 2.5

  return (
    <div className={`tool-popover align-${align}`}>
      <div className="popover-title">{TOOL_LABELS[tool]}</div>

      <div className="popover-row">
        <span className="popover-label">颜色</span>
        <div className="popover-swatches">
          {colors.map((color) => (
            <button
              key={color}
              className={`swatch ${style.color === color ? 'active' : ''}`}
              style={{ ['--swatch' as string]: color }}
              title={color}
              onClick={() => onChange({ color })}
            />
          ))}
          <label className="swatch custom" title="自定义颜色">
            <input
              type="color"
              value={style.color}
              onChange={(event) => onChange({ color: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="popover-slider">
        <div className="popover-label-row">
          <span className="popover-label">粗细</span>
          <b>{style.size.toFixed(1)}×</b>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={0.1}
          value={style.size}
          onChange={(event) => onChange({ size: Number(event.target.value) })}
        />
      </div>

      {tool === 'pen' || tool === 'fountain' ? (
        <PressureCurveEditor
          tool={tool}
          curve={style.curve}
          onChange={(curve) => onChange({ curve })}
        />
      ) : (
        <p className="popover-hint">固定线宽笔刷，不参与压感曲线。</p>
      )}

      <div className="popover-preview">
        <i
          style={{
            background: style.color,
            height: `${Math.max(2, style.size * (isHighlighter ? 9 : 4))}px`,
            opacity: isHighlighter ? 0.45 : 1,
          }}
        />
      </div>
    </div>
  )
}

interface EraserPopoverProps {
  radius: number
  barrelEraser: boolean
  align: 'left' | 'right'
  onChange: (radius: number) => void
  onBarrelEraserChange: (enabled: boolean) => void
}

function EraserPopover({
  radius,
  barrelEraser,
  align,
  onChange,
  onBarrelEraserChange,
}: EraserPopoverProps) {
  return (
    <div className={`tool-popover align-${align}`}>
      <div className="popover-title">橡皮</div>

      <div className="popover-slider">
        <div className="popover-label-row">
          <span className="popover-label">半径</span>
          <b>{radius} px</b>
        </div>
        <input
          type="range"
          min={4}
          max={40}
          step={1}
          value={radius}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>

      <div className="popover-preview">
        <i
          className="eraser-preview"
          style={{ width: radius * 2, height: radius * 2 }}
        />
      </div>

      <p className="popover-hint">
        数位笔的橡皮端会自动切换为擦除，无需先点这个按钮。
      </p>

      <label className="popover-check">
        <input
          type="checkbox"
          checked={barrelEraser}
          onChange={(event) => onBarrelEraserChange(event.target.checked)}
        />
        <span>笔杆侧键临时擦除</span>
      </label>
    </div>
  )
}

export function Toolbar(props: ToolbarProps) {
  const [open, setOpen] = useState<Tool | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(null)
    }

    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  // 键盘切换工具时，关掉不属于当前工具的浮层
  useEffect(() => {
    setOpen((current) => (current && current !== props.tool ? null : current))
  }, [props.tool])

  const hasPopover = (id: Tool) => isWritingTool(id) || id === 'eraser'

  const handleToolClick = (id: Tool) => {
    if (props.tool === id) {
      setOpen(hasPopover(id) && open !== id ? id : null)
    } else {
      props.onToolChange(id)
      setOpen(hasPopover(id) ? id : null)
    }
  }

  return (
    <div className="ink-toolbar" ref={rootRef}>
      {TOOLS.map(({ id, title, icon: Icon }, index) => {
        const align = index < 3 ? 'left' : 'right'
        return (
          <div className="tool-slot" key={id}>
            <button
              className={`tool-btn ${props.tool === id ? 'active' : ''}`}
              title={title}
              aria-haspopup={hasPopover(id) ? 'dialog' : undefined}
              aria-expanded={open === id}
              onClick={() => handleToolClick(id)}
            >
              <Icon size={17} />
            </button>

            {open === id && isWritingTool(id) && (
              <StylePopover
                tool={id}
                style={props.styles[id]}
                align={align}
                onChange={(patch) => props.onStyleChange(id, patch)}
              />
            )}

            {open === id && id === 'eraser' && (
              <EraserPopover
                radius={props.eraserRadius}
                barrelEraser={props.barrelEraser}
                align={align}
                onChange={props.onEraserRadiusChange}
                onBarrelEraserChange={props.onBarrelEraserChange}
              />
            )}
          </div>
        )
      })}

      <span className="tb-divider" />

      <button className="tool-btn" title="撤销 (Ctrl+Z)" onClick={props.onUndo}>
        <Undo2 size={17} />
      </button>
      <button className="tool-btn danger" title="清空本页" onClick={props.onClear}>
        <Trash size={16} />
      </button>
    </div>
  )
}
