import { useState } from 'react'

interface LeaveDialogProps {
  onSave: () => Promise<void>
  onDiscard: () => void
  onCancel: () => void
}

export function LeaveDialog({ onSave, onDiscard, onCancel }: LeaveDialogProps) {
  const [busy, setBusy] = useState(false)

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal leave-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <h2>未保存的修改</h2>
        </div>
        <div className="modal-body">
          <p className="leave-text">
            这份笔记还有未保存的修改。返回笔记库之前要保存吗？
          </p>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onCancel} disabled={busy}>
            取消
          </button>
          <button className="btn danger-text" onClick={onDiscard} disabled={busy}>
            不保存
          </button>
          <button
            className="btn primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onSave()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? '保存中…' : '保存并返回'}
          </button>
        </div>
      </div>
    </div>
  )
}
