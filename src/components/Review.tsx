import React from 'react'
import { Chess } from 'chess.js'

export default function Review() {
  const raw = localStorage.getItem('chess:mistakes')
  const arr = raw ? JSON.parse(raw) : []

  function loadPosition(fen: string) {
    // save position to fen storage and switch to play by reloading the page
    localStorage.setItem('chess:fen', fen)
    window.location.href = '/'
  }

  return (
    <div style={{padding:12}}>
      <h2>Review Mistakes</h2>
      {arr.length === 0 && <p>No mistakes recorded yet.</p>}
      <ul>
        {arr.map((m: any, i: number) => (
          <li key={i} style={{marginBottom:8}}>
            <div><strong>{m.mistakeType}</strong> — {new Date(m.date).toLocaleString()}</div>
            <div>Move: {m.userMove} <button onClick={() => loadPosition(m.position)}>Practice</button></div>
          </li>
        ))}
      </ul>
    </div>
  )
}
