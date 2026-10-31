const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs/promises')
const { getSettings, setSettings } = require('./settings.cjs')
const { streamChat } = require('./ai.cjs')

const devUrl = process.env.VITE_DEV_SERVER_URL
const activeChats = new Map()
const dirtyDocuments = new Map()
const closePrompts = new Set()

function createWindow() {
  const win = new BrowserWindow({
    width: 1560,
    height: 1000,
    minWidth: 1000,
    minHeight: 640,
    title: 'MathNote',
    // 自绘标题栏内容，但窗口按钮仍由桌面环境绘制（Window Controls Overlay）
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? {}
      : {
          titleBarOverlay: {
            color: '#ffffff00',
            symbolColor: '#3a3f46',
            height: 40,
          },
        }),
    roundedCorners: true,
    backgroundColor: '#ffffff',
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  win.on('maximize', () => win.webContents.send('window:maximized', true))
  win.on('unmaximize', () => win.webContents.send('window:maximized', false))
  win.on('enter-full-screen', () => win.webContents.send('window:maximized', true))
  win.on('leave-full-screen', () => win.webContents.send('window:maximized', false))

  win.on('close', (event) => {
    if (!dirtyDocuments.get(win.id)) return
    event.preventDefault()
    if (closePrompts.has(win.id)) return

    closePrompts.add(win.id)
    dialog
      .showMessageBox(win, {
        type: 'warning',
        title: '未保存的修改',
        message: '当前笔记还有未保存的修改，确定要关闭吗？',
        buttons: ['取消', '丢弃修改并关闭'],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      })
      .then(({ response }) => {
        if (response === 1) {
          dirtyDocuments.set(win.id, false)
          win.close()
        }
      })
      .finally(() => closePrompts.delete(win.id))
  })
  win.on('closed', () => {
    dirtyDocuments.delete(win.id)
    closePrompts.delete(win.id)
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ------------------------------------------------------------------ 窗口

function windowFrom(event) {
  return BrowserWindow.fromWebContents(event.sender)
}

ipcMain.on('window:minimize', (event) => windowFrom(event)?.minimize())

ipcMain.on('window:toggle-maximize', (event) => {
  const win = windowFrom(event)
  if (!win) return
  if (win.isMaximized()) win.unmaximize()
  else win.maximize()
})

ipcMain.on('window:close', (event) => windowFrom(event)?.close())

ipcMain.on('document:dirty', (event, dirty) => {
  const win = windowFrom(event)
  if (win) dirtyDocuments.set(win.id, Boolean(dirty))
})

ipcMain.handle('window:is-maximized', (event) => {
  return Boolean(windowFrom(event)?.isMaximized())
})

// ------------------------------------------------------------------ 文件

ipcMain.handle('save-png', async (_event, dataUrl) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '保存选区',
    defaultPath: 'selection.png',
    filters: [{ name: 'PNG', extensions: ['png'] }],
  })
  if (canceled || !filePath) return null

  const base64 = String(dataUrl).replace(/^data:image\/png;base64,/, '')
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
  return filePath
})

// ------------------------------------------------------------------ 设置

ipcMain.handle('settings:get', () => getSettings())
ipcMain.handle('settings:set', (_event, settings) => setSettings(settings))

ipcMain.handle('dialog:open-pdf', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入 PDF',
    properties: ['openFile'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]
  const data = await fs.readFile(filePath)
  return { name: path.basename(filePath), data }
})

ipcMain.handle('document:save', async (_event, payload) => {
  let filePath = payload.filePath
  if (!filePath) {
    const result = await dialog.showSaveDialog({
      title: '保存 MathNote 笔记',
      defaultPath: `${payload.suggestedName || '未命名笔记'}.mnote`,
      filters: [{ name: 'MathNote 笔记', extensions: ['mnote'] }],
    })
    if (result.canceled) return null
    filePath = result.filePath
  }
  if (!filePath) return null

  await fs.writeFile(filePath, Buffer.from(payload.data))
  return { path: filePath, name: path.basename(filePath) }
})

ipcMain.handle('document:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '打开 MathNote 笔记',
    properties: ['openFile'],
    filters: [{ name: 'MathNote 笔记', extensions: ['mnote'] }],
  })
  if (canceled || filePaths.length === 0) return null

  const filePath = filePaths[0]
  const data = await fs.readFile(filePath)
  return { path: filePath, name: path.basename(filePath), data }
})

ipcMain.handle('document:open-path', async (_event, filePath) => {
  if (typeof filePath !== 'string' || !filePath) return null
  const data = await fs.readFile(filePath)
  return { path: filePath, name: path.basename(filePath), data }
})

ipcMain.handle('dialog:confirm-discard', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return false
  const { response } = await dialog.showMessageBox(win, {
    type: 'warning',
    title: '未保存的修改',
    message: '当前笔记有未保存的修改，继续操作会丢弃这些修改。',
    buttons: ['取消', '丢弃修改并继续'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
  })
  return response === 1
})

// ------------------------------------------------------------------ AI

ipcMain.on('ai:start', (event, { id, request }) => {
  const controller = new AbortController()
  activeChats.set(id, controller)

  const send = (type, payload = {}) => {
    if (!event.sender.isDestroyed()) {
      event.sender.send('ai:event', { id, type, ...payload })
    }
  }

  streamChat(request, {
    signal: controller.signal,
    onDelta: (text) => send('delta', { text }),
  })
    .then(() => send('done'))
    .catch((error) => {
      const aborted = error?.name === 'AbortError'
      send('error', {
        message: aborted ? '已停止生成' : String(error?.message || error),
        aborted,
      })
    })
    .finally(() => activeChats.delete(id))
})

ipcMain.on('ai:cancel', (_event, { id }) => {
  activeChats.get(id)?.abort()
  activeChats.delete(id)
})
