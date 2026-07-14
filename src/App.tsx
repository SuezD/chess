import React, { useState } from 'react'
import ChessGame from './components/ChessGame'
import Review from './components/Review'

export default function App() {
  const [view, setView] = useState<'play' | 'review'>('play')
  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Chess Trainer</h1>
        <div className="app-navigation">
          <button onClick={() => setView('play')}>Play Game</button>
          <button onClick={() => setView('review')}>Review Mistakes</button>
        </div>
      </header>
      <main>
        {view === 'play' ? <ChessGame /> : <Review />}
      </main>
    </div>
  )
}
