import React from 'react'

type Props = {
  result: string
  lesson: string
  hint: string
  onNewGame: () => void
  onClose: () => void
}

export default function GameOverModal({ result, lesson, hint, onNewGame, onClose }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>Game complete</h3>
        <p className="modal-subtitle">Take one coach moment before the next game.</p>
        <div className="modal-body">
          <p><strong>Result:</strong> {result}</p>
          <p>{lesson}</p>
          <p className="hint-label"><strong>Coach prompt</strong></p>
          <p className="hint-text">{hint}</p>
        </div>
        <div className="modal-actions">
          <button onClick={onNewGame}>New game</button>
          <button className="secondary" onClick={onClose}>Keep position</button>
        </div>
      </div>
    </div>
  )
}
