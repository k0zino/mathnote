package cn.mathnote

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.weight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import cn.mathnote.ink.InkBrush
import cn.mathnote.ink.InkSurfaceView
import cn.mathnote.ui.MathNoteTheme
import kotlin.math.roundToInt

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MathNoteTheme {
                MathNoteApp()
            }
        }
    }
}

private val inkColors = listOf(
    Color(0xFF23262B), Color(0xFF3B64DC), Color(0xFFD1483B),
    Color(0xFF2F8F5B), Color(0xFFE8A33D),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MathNoteApp() {
    val context = LocalContext.current
    val controller = remember { NotebookController(context) }
    var inkView by remember { mutableStateOf<InkSurfaceView?>(null) }
    var brush by remember { mutableStateOf(InkBrush.Pen) }
    var strokeSize by remember { mutableFloatStateOf(1f) }
    var color by remember { mutableStateOf(inkColors.first()) }
    var pressure by remember { mutableFloatStateOf(0f) }
    var revision by remember { mutableIntStateOf(0) }
    var selectingNotebook by remember { mutableStateOf(false) }

    BackHandler(enabled = selectingNotebook) { selectingNotebook = false }

    if (selectingNotebook) {
        NotebookPickerScreen(
            notebooks = controller.notebooks,
            currentNotebookId = controller.currentNotebookId,
            onBack = { selectingNotebook = false },
            onCreate = {
                controller.createNotebook()
                selectingNotebook = false
                revision++
            },
            onSelect = { notebookId ->
                controller.openNotebook(notebookId)
                selectingNotebook = false
                revision++
            },
        )
        return
    }

    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = {
                    TextButton(onClick = { selectingNotebook = true }) { Text("笔记") }
                },
                title = {
                    Text(
                        controller.currentNotebook.name,
                        style = MaterialTheme.typography.titleLarge,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                },
                actions = {
                    TextButton(
                        enabled = controller.canUndo,
                        onClick = {
                            if (controller.undo()) revision++
                        },
                    ) { Text("撤销") }
                    TextButton(
                        enabled = controller.canRedo,
                        onClick = {
                            if (controller.redo()) revision++
                        },
                    ) { Text("重做") }
                    TextButton(
                        enabled = controller.currentPage.strokes.isNotEmpty(),
                        onClick = {
                            controller.clearCurrentPage()
                            revision++
                        },
                    ) { Text("清空") }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (controller.persistenceFailed) {
                Text(
                    "保存失败，请检查设备存储空间",
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp),
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            AndroidView(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f),
                factory = { viewContext ->
                    InkSurfaceView(viewContext).apply {
                        onStrokeFinished = {
                            controller.replaceCurrentStrokes(it)
                            revision++
                        }
                        onPressureChanged = { pressure = it }
                        inkView = this
                    }
                },
                update = { view ->
                    view.loadPage(
                        controller.currentNotebookId,
                        controller.currentPage.id,
                        controller.currentPage.strokes,
                        revision,
                    )
                    view.brush = brush
                    view.strokeSize = strokeSize
                    view.inkColor = color.toArgb()
                },
            )

            Surface(tonalElevation = 2.dp) {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextButton(
                            enabled = controller.currentPageIndex > 0,
                            onClick = {
                                controller.selectPage(
                                    controller.currentNotebook.pages[controller.currentPageIndex - 1].id,
                                )
                                revision++
                            },
                        ) { Text("上一页") }
                        Text(
                            "第 ${controller.currentPageIndex + 1} / ${controller.currentNotebook.pages.size} 页",
                            style = MaterialTheme.typography.labelLarge,
                        )
                        TextButton(
                            enabled = controller.currentPageIndex < controller.currentNotebook.pages.lastIndex,
                            onClick = {
                                controller.selectPage(
                                    controller.currentNotebook.pages[controller.currentPageIndex + 1].id,
                                )
                                revision++
                            },
                        ) { Text("下一页") }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.Center,
                    ) {
                        TextButton(onClick = {
                            controller.addPage()
                            revision++
                        }) { Text("新建页面") }
                        TextButton(
                            enabled = controller.currentNotebook.pages.size > 1,
                            onClick = {
                                controller.deleteCurrentPage()
                                revision++
                            },
                        ) { Text("删除页面") }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("笔刷", style = MaterialTheme.typography.labelLarge)
                        Text(
                            "压力 ${(pressure * 100).roundToInt()}%",
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Row(
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        InkBrush.entries.forEach { item ->
                            FilterChip(
                                selected = brush == item,
                                onClick = { brush = item },
                                label = { Text(item.label) },
                            )
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            inkColors.forEach { item ->
                                Box(
                                    modifier = Modifier
                                        .size(28.dp)
                                        .background(item, CircleShape)
                                        .clickable { color = item }
                                        .border(
                                            width = if (color == item) 3.dp else 1.dp,
                                            color = if (color == item) {
                                                MaterialTheme.colorScheme.primary
                                            } else {
                                                MaterialTheme.colorScheme.outlineVariant
                                            },
                                            shape = CircleShape,
                                        ),
                                )
                            }
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            listOf("细" to 0.6f, "中" to 1f, "粗" to 1.8f).forEach { (label, size) ->
                                FilterChip(
                                    selected = strokeSize == size,
                                    onClick = { strokeSize = size },
                                    label = { Text(label) },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun NotebookPickerScreen(
    notebooks: List<Notebook>,
    currentNotebookId: String,
    onBack: () -> Unit,
    onCreate: () -> Unit,
    onSelect: (String) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                navigationIcon = { TextButton(onClick = onBack) { Text("返回") } },
                title = { Text("我的笔记") },
                actions = { TextButton(onClick = onCreate) { Text("新建") } },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(notebooks, key = { it.id }) { notebook ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onSelect(notebook.id) },
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            notebook.name,
                            style = MaterialTheme.typography.titleMedium,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Text(
                            "${notebook.pages.size} 页" +
                                if (notebook.id == currentNotebookId) " · 当前笔记" else "",
                            modifier = Modifier.padding(top = 6.dp),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
