import type { ChatHandlers, ChatRequest, AiSettings } from './ipc'

export {}

declare global {
  interface Window {
    mathnote?: {
      platform: string
      savePng: (dataUrl: string) => Promise<string | null>
      getSettings: () => Promise<AiSettings>
      setSettings: (settings: AiSettings) => Promise<AiSettings>
      openPdf: () => Promise<{ name: string; data: Uint8Array } | null>
      saveDocument: (payload: {
        data: Uint8Array
        filePath: string | null
        suggestedName: string
      }) => Promise<{ path: string; name: string } | null>
      openDocument: () => Promise<{
        path: string
        name: string
        data: Uint8Array
      } | null>
      openDocumentPath: (filePath: string) => Promise<{
        path: string
        name: string
        data: Uint8Array
      } | null>
      confirmDiscard: () => Promise<boolean>
      setDocumentDirty: (dirty: boolean) => void
      chat: (request: ChatRequest, handlers: ChatHandlers) => () => void
      windowControls: {
        minimize: () => void
        toggleMaximize: () => void
        close: () => void
        isMaximized: () => Promise<boolean>
        onMaximizeChange: (callback: (maximized: boolean) => void) => () => void
      }
    }
  }
}
