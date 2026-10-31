package cn.mathnote

import android.content.Context
import cn.mathnote.data.NotebookStore
import cn.mathnote.ink.InkStroke
import cn.mathnote.ink.PAGE_HEIGHT
import cn.mathnote.ink.PAGE_WIDTH
import cn.mathnote.ink.copyInkStroke
import java.io.IOException
import java.util.UUID

data class NotePage(
    val id: String,
    val width: Float = PAGE_WIDTH,
    val height: Float = PAGE_HEIGHT,
    val strokes: List<InkStroke> = emptyList(),
)

data class Notebook(
    val id: String,
    val name: String,
    val pages: List<NotePage>,
    val currentPageId: String = pages.first().id,
)

private data class NotebookSnapshot(
    val pages: List<NotePage>,
    val currentPageId: String,
)

private class NotebookHistory {
    val undo = ArrayDeque<NotebookSnapshot>()
    val redo = ArrayDeque<NotebookSnapshot>()
}

class NotebookController(context: Context) {
    private val store = NotebookStore(context.applicationContext)
    private val items = mutableListOf<Notebook>()
    private val histories = mutableMapOf<String, NotebookHistory>()
    private var activeNotebookId = ""

    var persistenceFailed = false
        private set

    init {
        val stored = store.load()
        items += stored?.notebooks.orEmpty().ifEmpty {
            listOf(Notebook(newId(), "未命名笔记", listOf(blankPage())))
        }
        activeNotebookId = stored?.currentNotebookId
            ?.takeIf { id -> items.any { it.id == id } }
            ?: items.first().id
        if (stored == null) persist()
    }

    val notebooks: List<Notebook>
        get() = items.toList()

    val currentNotebookId: String
        get() = activeNotebookId

    val currentNotebook: Notebook
        get() = items.first { it.id == activeNotebookId }

    val currentPageIndex: Int
        get() = currentNotebook.pages.indexOfFirst { it.id == currentNotebook.currentPageId }
            .coerceAtLeast(0)

    val currentPage: NotePage
        get() = currentNotebook.pages[currentPageIndex]

    val canUndo: Boolean
        get() = history().undo.isNotEmpty()

    val canRedo: Boolean
        get() = history().redo.isNotEmpty()

    fun replaceCurrentStrokes(strokes: List<InkStroke>) {
        recordHistory()
        replaceCurrentPage(currentPage.copy(strokes = copyStrokes(strokes)))
        persist()
    }

    fun clearCurrentPage() {
        if (currentPage.strokes.isEmpty()) return
        replaceCurrentStrokes(emptyList())
    }

    fun addPage() {
        recordHistory()
        val page = blankPage()
        replaceCurrentNotebook(
            currentNotebook.copy(
                pages = currentNotebook.pages + page,
                currentPageId = page.id,
            ),
        )
        persist()
    }

    fun deleteCurrentPage() {
        if (currentNotebook.pages.size <= 1) return
        recordHistory()
        val remaining = currentNotebook.pages.filterNot { it.id == currentPage.id }
        val index = currentPageIndex.coerceAtMost(remaining.lastIndex)
        replaceCurrentNotebook(
            currentNotebook.copy(
                pages = remaining,
                currentPageId = remaining[index].id,
            ),
        )
        persist()
    }

    fun selectPage(pageId: String) {
        if (currentPage.id == pageId || currentNotebook.pages.none { it.id == pageId }) return
        replaceCurrentNotebook(currentNotebook.copy(currentPageId = pageId))
        persist()
    }

    fun createNotebook() {
        var number = items.size + 1
        var name = "未命名笔记 $number"
        while (items.any { it.name == name }) {
            number++
            name = "未命名笔记 $number"
        }
        val notebook = Notebook(newId(), name, listOf(blankPage()))
        items += notebook
        activeNotebookId = notebook.id
        persist()
    }

    fun openNotebook(notebookId: String) {
        if (items.none { it.id == notebookId }) return
        activeNotebookId = notebookId
        persist()
    }

    fun undo(): Boolean {
        val history = history()
        if (history.undo.isEmpty()) return false
        history.redo.addLast(snapshot())
        restore(history.undo.removeLast())
        persist()
        return true
    }

    fun redo(): Boolean {
        val history = history()
        if (history.redo.isEmpty()) return false
        history.undo.addLast(snapshot())
        restore(history.redo.removeLast())
        persist()
        return true
    }

    private fun history() = histories.getOrPut(activeNotebookId) { NotebookHistory() }

    private fun snapshot() = NotebookSnapshot(
        pages = currentNotebook.pages.map(::copyPage),
        currentPageId = currentNotebook.currentPageId,
    )

    private fun recordHistory() {
        val history = history()
        history.undo.addLast(snapshot())
        while (history.undo.size > 50) history.undo.removeFirst()
        history.redo.clear()
    }

    private fun restore(snapshot: NotebookSnapshot) {
        replaceCurrentNotebook(
            currentNotebook.copy(
                pages = snapshot.pages.map(::copyPage),
                currentPageId = snapshot.currentPageId,
            ),
        )
    }

    private fun replaceCurrentPage(page: NotePage) {
        val index = currentPageIndex
        replaceCurrentNotebook(
            currentNotebook.copy(
                pages = currentNotebook.pages.mapIndexed { pageIndex, item ->
                    if (pageIndex == index) page else item
                },
            ),
        )
    }

    private fun replaceCurrentNotebook(notebook: Notebook) {
        val index = items.indexOfFirst { it.id == activeNotebookId }
        items[index] = notebook
    }

    private fun persist() {
        persistenceFailed = try {
            store.save(items, activeNotebookId)
            false
        } catch (_: IOException) {
            true
        } catch (_: SecurityException) {
            true
        }
    }

    private fun blankPage() = NotePage(id = newId())

    private fun newId(): String = UUID.randomUUID().toString()
}

private fun copyPage(page: NotePage): NotePage = page.copy(strokes = copyStrokes(page.strokes))

private fun copyStrokes(strokes: List<InkStroke>): List<InkStroke> = strokes.map(::copyInkStroke)
