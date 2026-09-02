import type { ReactNode } from 'react'

interface Props {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export default function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <div className="modal-header">
          <h2 className="form-title">{title}</h2>
          <button className="icon-btn modal-close" onClick={onClose} title="Fechar">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
