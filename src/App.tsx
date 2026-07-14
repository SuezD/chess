import React, { useState } from 'react'
import ChessGame from './components/ChessGame'
import Review from './components/Review'

export default function App() {
  const [view, setView] = useState<'play' | 'review'>('play')
  const [newGameRequest, setNewGameRequest] = useState(0)

  function startNewGame() {
    setNewGameRequest(request => request + 1)
    setView('play')
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Chess Trainer</h1>
        <div className="app-navigation">
          <button onClick={startNewGame}>New Game</button>
          <button onClick={() => setView('review')}>Review Mistakes</button>
        </div>
      </header>
      <main>
        {view === 'play' ? <ChessGame newGameRequest={newGameRequest} /> : <Review />}
      </main>
    </div>
  )
}
