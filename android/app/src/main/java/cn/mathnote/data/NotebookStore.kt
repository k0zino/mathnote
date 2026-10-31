package cn.mathnote.data

import android.content.Context
import cn.mathnote.NotePage
import cn.mathnote.Notebook
import cn.mathnote.ink.InkBrush
import cn.mathnote.ink.InkPoint
import cn.mathnote.ink.InkStroke
import cn.mathnote.ink.PAGE_HEIGHT
import cn.mathnote.ink.PAGE_WIDTH
import org.json.JSONObject
import java.io.File

data class StoredWorkspace(
    val notebooks: List<Notebook>,
    val currentNotebookId: String,
)

class NotebookStore(context: Context) {
    private val file = File(context.filesDir, "notebooks.json")

    fun load(): StoredWorkspace? = try {
        if (!file.isFile) {
            null
        } else {
            val root = JSONObject(file.readText())
            val notebooksJson = root.getJSONArray("notebooks")
            val notebooks = mutableListOf<Notebook>()
            for (index in 0 until notebooksJson.length()) {
                parseNotebook(notebooksJson.optJSONObject(index))?.let(notebooks::add)
            }
            if (notebooks.isEmpty()) {
                null
            } else {
                StoredWorkspace(notebooks, root.optString("currentNotebookId"))
            }
        }
    } catch (_: Exception) {
        null
    }

    fun save(notebooks: List<Notebook>, currentNotebookId: String) {
        val notebooksJson = org.json.JSONArray()
        notebooks.forEach { notebook ->
            val pagesJson = org.json.JSONArray()
            notebook.pages.forEach { page ->
                val strokesJson = org.json.JSONArray()
                page.strokes.forEach { stroke ->
                    val pointsJson = org.json.JSONArray()
                    stroke.points.forEach { point ->
                        pointsJson.put(
                            JSONObject()
                                .put("x", point.x.toDouble())
                                .put("y", point.y.toDouble())
                                .put("pressure", point.pressure.toDouble())
                                .put("timestamp", point.timestamp.toDouble()),
                        )
                    }
                    strokesJson.put(
                        JSONObject()
                            .put("color", stroke.color)
                            .put("size", stroke.size.toDouble())
                            .put("brush", stroke.brush.id)
                            .put("points", pointsJson),
                    )
                }
                pagesJson.put(
                    JSONObject()
                        .put("id", page.id)
                        .put("width", page.width.toDouble())
                        .put("height", page.height.toDouble())
                        .put("strokes", strokesJson),
                )
            }
            notebooksJson.put(
                JSONObject()
                    .put("id", notebook.id)
                    .put("name", notebook.name)
                    .put("currentPageId", notebook.currentPageId)
                    .put("pages", pagesJson),
            )
        }
        val content = JSONObject()
            .put("version", 1)
            .put("currentNotebookId", currentNotebookId)
            .put("notebooks", notebooksJson)
            .toString(2)
        val temporary = File(file.parentFile, "${file.name}.tmp")
        temporary.writeText(content)
        if (!temporary.renameTo(file)) {
            file.writeText(content)
            temporary.delete()
        }
    }

    private fun parseNotebook(json: JSONObject?): Notebook? {
        json ?: return null
        val id = json.optString("id").takeIf { it.isNotBlank() } ?: return null
        val name = json.optString("name").takeIf { it.isNotBlank() } ?: return null
        val pagesJson = json.optJSONArray("pages") ?: return null
        val pages = mutableListOf<NotePage>()
        for (index in 0 until pagesJson.length()) {
            parsePage(pagesJson.optJSONObject(index))?.let(pages::add)
        }
        if (pages.isEmpty()) return null
        val currentPageId = json.optString("currentPageId")
            .takeIf { pageId -> pages.any { it.id == pageId } }
            ?: pages.first().id
        return Notebook(id, name, pages, currentPageId)
    }

    private fun parsePage(json: JSONObject?): NotePage? {
        json ?: return null
        val id = json.optString("id").takeIf { it.isNotBlank() } ?: return null
        val width = json.optDouble("width", PAGE_WIDTH.toDouble())
        val height = json.optDouble("height", PAGE_HEIGHT.toDouble())
        if (!width.isFinite() || width <= 0.0 || !height.isFinite() || height <= 0.0) return null
        val strokesJson = json.optJSONArray("strokes") ?: return null
        val strokes = mutableListOf<InkStroke>()
        for (index in 0 until strokesJson.length()) {
            parseStroke(strokesJson.optJSONObject(index))?.let(strokes::add)
        }
        return NotePage(id, width.toFloat(), height.toFloat(), strokes)
    }

    private fun parseStroke(json: JSONObject?): InkStroke? {
        json ?: return null
        val brush = InkBrush.entries.firstOrNull { it.id == json.optInt("brush", -1) } ?: return null
        val size = json.optDouble("size", Double.NaN)
        if (!size.isFinite() || size <= 0.0 || !json.has("color")) return null
        val pointsJson = json.optJSONArray("points") ?: return null
        val points = mutableListOf<InkPoint>()
        for (index in 0 until pointsJson.length()) {
            val point = pointsJson.optJSONObject(index) ?: return null
            val x = point.optDouble("x", Double.NaN)
            val y = point.optDouble("y", Double.NaN)
            val pressure = point.optDouble("pressure", Double.NaN)
            val timestamp = point.optDouble("timestamp", Double.NaN)
            if (!x.isFinite() || !y.isFinite() || !pressure.isFinite() || !timestamp.isFinite()) {
                return null
            }
            points += InkPoint(
                x.toFloat(),
                y.toFloat(),
                pressure.toFloat().coerceIn(0.05f, 1f),
                timestamp.toFloat(),
            )
        }
        if (points.isEmpty()) return null
        return InkStroke(points, json.optInt("color"), size.toFloat(), brush)
    }
}
