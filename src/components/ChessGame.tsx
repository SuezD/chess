import React, { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'

import { Chessboard } from 'react-chessboard'
import MistakeModal from './MistakeModal'
export default function ChessGame() {
  const chessRef = useRef(new Chess())
  const [fen, setFen] = useState(chessRef.current.fen())
  const [orientation] = useState<'white' | 'black'>('white')

  useEffect(() => {
    // load saved game if present
    try {
      const saved = localStorage.getItem('chess:fen')
      if (saved) {
        chessRef.current.load(saved)
        setFen(chessRef.current.fen())
      }
    } catch (e) {
      // ignore
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('chess:fen', fen)
  }, [fen])

  function makeBotMove() {
    const moves = chessRef.current.moves({ verbose: true })
    if (moves.length === 0) return
    // very weak bot: pick a random legal move
    const choice = moves[Math.floor(Math.random() * moves.length)]
    chessRef.current.move({ from: choice.from, to: choice.to, promotion: 'q' })
    setFen(chessRef.current.fen())
  }

  // Mistake detection heuristics
  function materialValue(pieceType: string | null) {
    if (!pieceType) return 0
    switch (pieceType.toLowerCase()) {
      case 'p': return 1
      case 'n': return 3
      case 'b': return 3
      case 'r': return 5
      case 'q': return 9
      default: return 0
    }
  }

  const [modal, setModal] = useState<null | { explanation: string, bestMove?: string, mistakeType?: string, fen: string }>(null)

  function saveMistakeRecord(record: any) {
    try {
      const raw = localStorage.getItem('chess:mistakes')
      const arr = raw ? JSON.parse(raw) : []
      arr.push(record)
      localStorage.setItem('chess:mistakes', JSON.stringify(arr))
    } catch (e) {
      // ignore
    }
  }

  function detectMistake(beforeFen: string, afterFen: string, userMove: any) {
    const before = new Chess(beforeFen)
    const after = new Chess(afterFen)
    // simple: detect hanging pieces - any side's piece attacked and undefended
    const color = before.turn()
    // material before/after
    const materialBefore = materialCount(before, color)
    const materialAfter = materialCount(after, color)
    if (materialAfter < materialBefore) {
      const explanation = 'You lost material with that move.'
      return { isMistake: true, type: 'bad_trade', explanation }
    }

    // detect hanging pieces: after the move, see if any of player's pieces are attacked and have fewer defenders
    const board = after.board()
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const sq = 'abcdefgh'[f] + (8 - r)
        const p = after.get(sq)
        if (p && p.color === color) {
          const attackers = after.moves({ square: sq, verbose: true }).filter(m => m.flags.includes('c') || m.flags.includes('e'))
          // attackers are moves to capture that square by the opposite color
          // quick heuristic: if any opponent piece can capture this square and before it wasn't capturable, flag
          const beforeAttackers = before.moves({ square: sq, verbose: true }).filter(m => m.flags.includes('c') || m.flags.includes('e'))
          if (attackers.length > 0 && beforeAttackers.length === 0) {
            const explanation = `Your piece on ${sq} is now hanging and can be captured.`
            return { isMistake: true, type: 'hanging_piece', explanation }
          }
        }
      }
    }

    // default: not a major mistake
    return { isMistake: false }
  }

  function materialCount(game: Chess, color: string) {
    const board = game.board()
    let total = 0
    for (const row of board) {
      for (const p of row) {
        if (p && p.color === color) total += materialValue(p.type)
      }
    }
    return total
  }

  const [selected, setSelected] = useState<string | null>(null)

  function onSquareClick(square: string) {
    if (!selected) {
      // select a piece if it belongs to the player to move
      const piece = chessRef.current.get(square)
      if (piece && piece.color === chessRef.current.turn()) {
        setSelected(square)
      }
      return
    }

    // attempt move from selected -> square
    const move = chessRef.current.move({ from: selected, to: square, promotion: 'q' })
    setSelected(null)
    if (move === null) return
    setFen(chessRef.current.fen())

    // bot replies after short delay
    setTimeout(() => {
      if (!chessRef.current.game_over()) {
        makeBotMove()
      }
    }, 300)
  }
  function onPieceDrop(source: string, target: string) {
    const beforeFen = chessRef.current.fen()
    const move = chessRef.current.move({ from: source, to: target, promotion: 'q' })
    if (move === null) return false
    const afterFen = chessRef.current.fen()
    setFen(afterFen)

    const result = detectMistake(beforeFen, afterFen, move)
    if (result.isMistake) {
      // show modal and save
      setModal({ explanation: result.explanation, bestMove: result.bestMove, mistakeType: result.type, fen: afterFen })
      saveMistakeRecord({ mistakeType: result.type, position: beforeFen, userMove: `${move.from}${move.to}`, bestMove: result.bestMove || null, date: new Date().toISOString(), solved: false })
      return true
    }

    setTimeout(() => {
      if (!chessRef.current.game_over()) {
        makeBotMove()
      }
    }, 300)

    return true
  }

  return (
    <div className="game-container">
      <div className="board-wrap">
        <div className="board">
          <Chessboard
            options={{
              position: fen,
              boardOrientation: orientation,
              allowDragging: true,
              boardStyle: { width: Math.min(480, Math.max(320, window.innerWidth - 40)) },
              onPieceDrop: ({ sourceSquare, targetSquare }) => onPieceDrop(sourceSquare as string, targetSquare as string | null),
            }}
          />
        </div>
      </div>
      <div className="status">
        <p>FEN: {fen}</p>
      </div>
      {modal && (
        <MistakeModal
          explanation={modal.explanation}
          bestMove={modal.bestMove}
          onRetry={() => {
            // reload position before move
            chessRef.current.load(modal.fen)
            setFen(modal.fen)
            setModal(null)
          }}
          onShow={() => {
            alert(modal.explanation + (modal.bestMove ? '\nBest move: ' + modal.bestMove : ''))
          }}
          onContinue={() => {
            setModal(null)
            setTimeout(() => {
              if (!chessRef.current.game_over()) makeBotMove()
            }, 200)
          }}
        />
      )}
    </div>
  )
}
