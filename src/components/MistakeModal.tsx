import React from 'react'

type Props = {
  category: string
  concept: string
  explanation: string
  hint: string
  showAnswer: boolean
  bestMove?: string | null
  onRetry: () => void
  onHint: () => void
  onShow: () => void
  onContinue: () => void
}

export default function MistakeModal({ category, concept, explanation, hint, showAnswer, bestMove, onRetry, onHint, onShow, onContinue }: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>⚠️ Let’s look at that move</h3>
        <p className="modal-subtitle">Something important changed. Can you spot it?</p>
        <div className="modal-body">
          <p><strong>Concept:</strong> {concept}</p>
          <p>{explanation}</p>
          <p className="hint-label"><strong>Hint</strong></p>
          <p className="hint-text">{hint}</p>
          {showAnswer && (
            <div className="modal-answer">
              <p><strong>Explanation</strong></p>
              <p>{explanation}</p>
              {bestMove && <p><strong>Best move:</strong> {bestMove}</p>}
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button onClick={onRetry}>Look again</button>
          <button onClick={onHint}>Hint</button>
          <button onClick={onShow}>Show answer</button>
          <button onClick={onContinue}>Continue anyway</button>
        </div>
      </div>
    </div>
  )
}
