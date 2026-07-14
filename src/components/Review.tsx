import React, { useMemo, useState } from 'react'

type MistakeRecord = {
  id: string
  position: string
  playedMove: string
  bestMove?: string | null
  mistakeCategory: string
  concept: string
  explanation: string
  date: string
  resolved: boolean
}

const focusOrder = ['Piece Safety', 'Threat Awareness', 'Winning Material', 'Simple Tactics', 'Opening Principles']

export default function Review() {
  const raw = localStorage.getItem('chess:mistakes')
  const initialRecords: MistakeRecord[] = raw ? JSON.parse(raw) : []
  const [records, setRecords] = useState<MistakeRecord[]>(initialRecords)

  const summary = useMemo(() => {
    const counts = records.reduce<Record<string, number>>((acc, item) => {
      acc[item.concept] = (acc[item.concept] || 0) + 1
      return acc
    }, {})
    return focusOrder.map(concept => ({ concept, mistakes: counts[concept] || 0 }))
  }, [records])

  function persist(updated: MistakeRecord[]) {
    localStorage.setItem('chess:mistakes', JSON.stringify(updated))
    setRecords(updated)
  }

  function loadPosition(fen: string) {
    localStorage.setItem('chess:fen', fen)
    window.location.href = '/'
  }

  function toggleResolved(id: string) {
    persist(records.map(item => item.id === id ? { ...item, resolved: !item.resolved } : item))
  }

  return (
    <div className="review-page">
      <div className="review-summary">
        <h2>Review Mistakes</h2>
        {records.length === 0 ? (
          <p>No mistakes recorded yet.</p>
        ) : (
          <div className="progress-block">
            <p><strong>Current focus</strong></p>
            <ul className="progress-list">
              {summary.map(item => (
                <li key={item.concept} className={item.mistakes === 0 ? 'complete' : 'active'}>
                  {item.mistakes === 0 ? '✅' : '🟡'} {item.concept} {item.mistakes > 0 ? `(${item.mistakes})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="review-list">
        {records.length === 0 ? null : records.map(record => (
          <div className="review-card" key={record.id}>
            <div className="review-card-header">
              <div>
                <strong>{record.mistakeCategory}</strong>
                <span className="review-card-concept">{record.concept}</span>
              </div>
              <button className="secondary" onClick={() => toggleResolved(record.id)}>
                {record.resolved ? 'Mark unresolved' : 'Mark resolved'}
              </button>
            </div>
            <div className="review-card-body">
              <p>{record.explanation}</p>
              <p><strong>Move:</strong> {record.playedMove}</p>
              {record.bestMove && <p><strong>Best move:</strong> {record.bestMove}</p>}
            </div>
            <div className="review-card-footer">
              <span>{new Date(record.date).toLocaleString()}</span>
              <button onClick={() => loadPosition(record.position)}>Practice</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
