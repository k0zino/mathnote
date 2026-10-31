const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('mathnote', {
  platform: process.platform,

  savePng: (dataUrl) => ipcRenderer.invoke('save-png', dataUrl),

  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (settings) => ipcRenderer.invoke('settings:set', settings),
  openPdf: () => ipcRenderer.invoke('dialog:open-pdf'),
  saveDocument: (payload) => ipcRenderer.invoke('document:save', payload),
  openDocument: () => ipcRenderer.invoke('document:open'),
  openDocumentPath: (filePath) => ipcRenderer.invoke('document:open-path', filePath),
  confirmDiscard: () => ipcRenderer.invoke('dialog:confirm-discard'),
  setDocumentDirty: (dirty) => ipcRenderer.send('document:dirty', dirty),

  /**
   * 启动一次流式对话，返回取消函数。
   * handlers: { onDelta(text), onDone(), onError(message) }
   */
  chat: (request, handlers) => {
    const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

    const cleanup = () => ipcRenderer.removeListener('ai:event', listener)
    const listener = (_event, msg) => {
      if (!msg || msg.id !== id) return
      if (msg.type === 'delta') handlers.onDelta?.(msg.text)
      else if (msg.type === 'done') {
        cleanup()
        handlers.onDone?.()
      } else if (msg.type === 'error') {
        cleanup()
        handlers.onError?.(msg.message, msg.aborted)
      }
    }

    ipcRenderer.on('ai:event', listener)
    ipcRenderer.send('ai:start', { id, request })

    return () => {
      cleanup()
      ipcRenderer.send('ai:cancel', { id })
    }
  },

  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximizeChange: (callback) => {
      const listener = (_event, maximized) => callback(maximized)
      ipcRenderer.on('window:maximized', listener)
      return () => ipcRenderer.removeListener('window:maximized', listener)
    },
  },
})
