package cn.mathnote.ink

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.util.AttributeSet
import android.view.MotionEvent as AndroidMotionEvent
import android.view.View
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

const val PAGE_WIDTH = 820f
const val PAGE_HEIGHT = 1160f

enum class InkBrush(val id: Int, val label: String) {
    Pen(0, "压感笔"),
    Ballpoint(1, "圆珠笔"),
    Fountain(2, "钢笔"),
    Highlighter(3, "荧光笔"),
}

data class InkPoint(val x: Float, val y: Float, val pressure: Float, val timestamp: Float)

data class InkStroke(
    val points: MutableList<InkPoint>,
    val color: Int,
    val size: Float,
    val brush: InkBrush,
    var commands: FloatArray? = null,
)

fun copyInkStroke(stroke: InkStroke): InkStroke = InkStroke(
    points = stroke.points.map { it.copy() }.toMutableList(),
    color = stroke.color,
    size = stroke.size,
    brush = stroke.brush,
    commands = null,
)

class InkSurfaceView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {
    var brush = InkBrush.Pen
    var inkColor = Color.rgb(35, 38, 43)
    var strokeSize = 1f
    var onStrokeFinished: ((List<InkStroke>) -> Unit)? = null
    var onPressureChanged: ((Float) -> Unit)? = null

    private val strokes = mutableListOf<InkStroke>()
    private var current: InkStroke? = null
    private var activePointerId = AndroidMotionEvent.INVALID_POINTER_ID
    private var lastPressureTimestamp = 0L
    private var pageScale = 1f
    private var pageLeft = 0f
    private var pageTop = 0f
    private var loadedNotebookId: String? = null
    private var loadedPageId: String? = null
    private var loadedRevision = -1

    private val pagePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.rgb(220, 223, 228)
        style = Paint.Style.STROKE
        strokeWidth = 1f
    }
    private val inkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val path = Path()

    fun loadPage(
        notebookId: String,
        pageId: String,
        pageStrokes: List<InkStroke>,
        revision: Int,
    ) {
        if (loadedNotebookId == notebookId && loadedPageId == pageId && loadedRevision == revision) {
            return
        }
        loadedNotebookId = notebookId
        loadedPageId = pageId
        loadedRevision = revision
        strokes.clear()
        strokes += pageStrokes.map(::copyInkStroke)
        current = null
        activePointerId = AndroidMotionEvent.INVALID_POINTER_ID
        parent.requestDisallowInterceptTouchEvent(false)
        onPressureChanged?.invoke(0f)
        invalidate()
    }

    fun snapshotStrokes(): List<InkStroke> = strokes.map(::copyInkStroke)

    override fun onSizeChanged(width: Int, height: Int, oldWidth: Int, oldHeight: Int) {
        val usableWidth = max(1f, width - 32f)
        val usableHeight = max(1f, height - 32f)
        pageScale = min(usableWidth / PAGE_WIDTH, usableHeight / PAGE_HEIGHT)
        pageLeft = (width - PAGE_WIDTH * pageScale) / 2f
        pageTop = (height - PAGE_HEIGHT * pageScale) / 2f
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        canvas.drawColor(Color.rgb(244, 245, 247))
        canvas.save()
        canvas.translate(pageLeft, pageTop)
        canvas.scale(pageScale, pageScale)
        canvas.drawRect(0f, 0f, PAGE_WIDTH, PAGE_HEIGHT, pagePaint)
        canvas.clipRect(0f, 0f, PAGE_WIDTH, PAGE_HEIGHT)
        for (stroke in strokes) drawStroke(canvas, stroke)
        current?.let { drawStroke(canvas, it) }
        canvas.restore()
        canvas.drawRect(pageLeft, pageTop, pageLeft + PAGE_WIDTH * pageScale,
            pageTop + PAGE_HEIGHT * pageScale, borderPaint)
    }

    override fun onTouchEvent(event: AndroidMotionEvent): Boolean {
        when (event.actionMasked) {
            AndroidMotionEvent.ACTION_DOWN -> {
                if (activePointerId != AndroidMotionEvent.INVALID_POINTER_ID) return true
                val index = event.actionIndex
                if (event.getToolType(index) == AndroidMotionEvent.TOOL_TYPE_FINGER && event.pointerCount > 1) {
                    return false
                }
                activePointerId = event.getPointerId(index)
                current = InkStroke(mutableListOf(), inkColor, strokeSize, brush)
                parent.requestDisallowInterceptTouchEvent(true)
                addPoint(event, index, -1, true)
                return true
            }

            AndroidMotionEvent.ACTION_MOVE -> {
                val index = event.findPointerIndex(activePointerId)
                if (index < 0) return true
                for (history in 0 until event.historySize) addPoint(event, index, history, false)
                addPoint(event, index, -1, false)
                return true
            }

            AndroidMotionEvent.ACTION_UP -> {
                val index = event.findPointerIndex(activePointerId)
                if (index < 0) return true
                finishStroke(event, index)
                return true
            }

            AndroidMotionEvent.ACTION_POINTER_UP -> {
                val index = event.actionIndex
                if (event.getPointerId(index) == activePointerId) finishStroke(event, index)
                return true
            }

            AndroidMotionEvent.ACTION_CANCEL -> {
                current = null
                activePointerId = AndroidMotionEvent.INVALID_POINTER_ID
                parent.requestDisallowInterceptTouchEvent(false)
                invalidate()
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    private fun finishStroke(event: AndroidMotionEvent, index: Int) {
        addPoint(event, index, -1, false)
        current?.let {
            if (it.points.isNotEmpty()) strokes += it
        }
        current = null
        activePointerId = AndroidMotionEvent.INVALID_POINTER_ID
        parent.requestDisallowInterceptTouchEvent(false)
        onStrokeFinished?.invoke(snapshotStrokes())
        invalidate()
    }

    private fun addPoint(event: AndroidMotionEvent, index: Int, history: Int, first: Boolean) {
        val historical = history >= 0
        val rawX = if (historical) event.getHistoricalX(index, history) else event.getX(index)
        val rawY = if (historical) event.getHistoricalY(index, history) else event.getY(index)
        val rawPressure = if (historical) event.getHistoricalPressure(index, history) else event.getPressure(index)
        val timestamp = if (historical) event.getHistoricalEventTime(history) else event.eventTime
        val stylus = event.getToolType(index) == AndroidMotionEvent.TOOL_TYPE_STYLUS ||
            event.getToolType(index) == AndroidMotionEvent.TOOL_TYPE_ERASER
        var pressure = if (stylus) rawPressure.coerceIn(0.05f, 1f) else 0.5f
        if (first && pressure < 0.25f) pressure = 0.25f
        if (timestamp - lastPressureTimestamp >= 80) {
            onPressureChanged?.invoke(pressure)
            lastPressureTimestamp = timestamp
        }

        val stroke = current ?: return
        val point = InkPoint((rawX - pageLeft) / pageScale, (rawY - pageTop) / pageScale,
            pressure, timestamp.toFloat())
        stroke.points.lastOrNull()?.let {
            val dx = point.x - it.x
            val dy = point.y - it.y
            if (dx * dx + dy * dy < 0.09f) return
        }
        stroke.points += point
        stroke.commands = null
        invalidate()
    }

    private fun drawStroke(canvas: Canvas, stroke: InkStroke) {
        val packedPoints = FloatArray(stroke.points.size * 4)
        stroke.points.forEachIndexed { index, point ->
            packedPoints[index * 4] = point.x
            packedPoints[index * 4 + 1] = point.y
            packedPoints[index * 4 + 2] = point.pressure
            packedPoints[index * 4 + 3] = point.timestamp
        }
        val commands = stroke.commands ?: InkNative.nativeRenderStroke(
            packedPoints, stroke.brush.id, stroke.size,
        ).also { stroke.commands = it }

        inkPaint.color = stroke.color
        inkPaint.alpha = if (stroke.brush == InkBrush.Highlighter) 89 else 255
        path.rewind()
        var hasPath = false
        var index = 0
        while (index + 4 < commands.size) {
            when (commands[index].roundToInt()) {
                1 -> {
                    path.moveTo(commands[index + 1], commands[index + 2])
                    hasPath = true
                }
                2 -> path.lineTo(commands[index + 1], commands[index + 2])
                3 -> path.close()
                4 -> canvas.drawCircle(commands[index + 1], commands[index + 2],
                    commands[index + 3], inkPaint)
                5 -> canvas.drawRect(commands[index + 1], commands[index + 2],
                    commands[index + 1] + commands[index + 3],
                    commands[index + 2] + commands[index + 4], inkPaint)
            }
            index += 5
        }
        if (hasPath) canvas.drawPath(path, inkPaint)
    }
}
