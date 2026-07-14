import React, { useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import { Chessboard } from 'react-chessboard'
import GameOverModal from './GameOverModal'
import MistakeModal from './MistakeModal'

type StockfishAnalysis = {
  bestMove?: string
  scoreCp?: number
  mate?: number
  pv?: string[]
}

type ModalState = {
  beforeFen: string
  afterFen: string
  userMove: string
  explanation: string
  bestMove?: string | null
  category: string
  concept: string
  detail?: { square?: string; piece?: string; targetSquare?: string }
  hintStage: number
  showAnswer: boolean
}

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

type GameOverDetails = {
  result: string
  lesson: string
  hint: string
}

const engineUrl = '/stockfish/stockfish-18-asm.js?engine=v2'
const engineDepth = 10
const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

const categoryMap: Record<string, { label: string; concept: string }> = {
  bad_trade: { label: 'Bad trade', concept: 'Winning Material' },
  hanging_piece: { label: 'Hanging piece', concept: 'Piece Safety' },
  missed_capture: { label: 'Missed capture', concept: 'Winning Material' },
  missed_mate: { label: 'Missed mate', concept: 'Simple Tactics' },
  allowing_checkmate: { label: 'Allowing mate', concept: 'Piece Safety' },
}

const hintTemplates: Record<string, string[]> = {
  bad_trade: [
    'Compare the material on the board before and after your move.',
    'Did you give up more than you gained?',
    'Your move traded away material and left you worse off.',
  ],
  hanging_piece: [
    'Look for pieces the opponent can capture next.',
    'Which one of your pieces is attacked and not defended?',
    'Your piece is hanging and can be taken on the next move.',
  ],
  missed_capture: [
    'Look at the captures available to you.',
    'Can you take an undefended enemy piece?',
    'You missed a free capture that would improve your material.',
  ],
  missed_mate: [
    'Look for checks and quick finishes.',
    'Is there a forced mate in one?',
    'There was a checkmate available, but you missed it.',
  ],
  allowing_checkmate: [
    'Your king is under threat after that move.',
    'Can your opponent checkmate you next?',
    'You allowed a mate-in-one threat.',
  ],
}

function pieceName(type: string | null) {
  switch (type) {
    case 'p': return 'pawn'
    case 'n': return 'knight'
    case 'b': return 'bishop'
    case 'r': return 'rook'
    case 'q': return 'queen'
    case 'k': return 'king'
    default: return 'piece'
  }
}

function materialValue(pieceType: string | null) {
  if (!pieceType) return 0
  return pieceValues[pieceType.toLowerCase()] || 0
}

function countMaterial(game: Chess, color: string) {
  return game.board().flat().reduce((sum, p) => {
    if (p && p.color === color) return sum + materialValue(p.type)
    return sum
  }, 0)
}

function countAttackers(game: Chess, square: string, attackerColor: string) {
  return game.moves({ square, verbose: true }).filter(m => m.color === attackerColor && (m.flags.includes('c') || m.flags.includes('e'))).length
}

function findHangingPiece(game: Chess, color: string) {
  const board = game.board()
  for (let rank = 0; rank < 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = 'abcdefgh'[file] + (8 - rank)
      const piece = game.get(square)
      if (!piece || piece.color !== color) continue
      const attackers = countAttackers(game, square, color === 'w' ? 'b' : 'w')
      const defenders = countAttackers(game, square, color)
      if (attackers > 0 && defenders === 0) {
        return { square, piece: pieceName(piece.type) }
      }
    }
  }
  return null
}

function findFreeCapture(game: Chess, color: string) {
  const moves = game.moves({ verbose: true })
  const captureMoves = moves
    .filter(m => m.flags.includes('c') || m.flags.includes('e'))
    .sort((a, b) => materialValue(b.captured?.type || '') - materialValue(a.captured?.type || ''))

  for (const move of captureMoves) {
    if (!move.captured) continue
    const target = move.to
    const defenderCount = countAttackers(game, target, move.piece === 'p' ? (color === 'w' ? 'b' : 'w') : (color === 'w' ? 'b' : 'w'))
    if (defenderCount === 0) {
      return { from: move.from, to: move.to, captured: move.captured }
    }
  }

  return null
}

function parseHint(category: string, detail?: { square?: string; piece?: string; targetSquare?: string }, stage = 1) {
  const templates = hintTemplates[category] || []
  const raw = templates[Math.min(stage - 1, templates.length - 1)] || 'Look closely at the position and see what changed.'
  return raw
    .replace('{square}', detail?.square || 'that square')
    .replace('{piece}', detail?.piece || 'piece')
    .replace('{targetSquare}', detail?.targetSquare || 'that square')
}

function buildGameOverDetails(game: Chess): GameOverDetails {
  if (game.isCheckmate()) {
    const winner = game.turn() === 'w' ? 'Black' : 'White'
    const userWon = winner === 'White'
    return {
      result: `${winner} won by checkmate.`,
      lesson: userWon
        ? 'Nice finish. You converted the position by leaving the king with no legal escape.'
        : 'Your king was checkmated. The useful lesson is to rewind the final threat and notice when the escape squares disappeared.',
      hint: userWon
        ? 'Which checking move removed the last safe square?'
        : 'Before starting again, find the move where the mating threat became impossible to ignore.',
    }
  }

  if (game.isStalemate()) {
    return {
      result: 'Draw by stalemate.',
      lesson: 'The side to move had no legal moves, but the king was not in check.',
      hint: 'When you are winning, leave the opponent one legal move unless you are giving checkmate.',
    }
  }

  if (game.isInsufficientMaterial()) {
    return {
      result: 'Draw by insufficient material.',
      lesson: 'There is not enough material left on the board for either side to force checkmate.',
      hint: 'In simple endings, ask whether your remaining pieces can actually create mate.',
    }
  }

  if (game.isThreefoldRepetition()) {
    return {
      result: 'Draw by repetition.',
      lesson: 'The same position appeared three times, so the game is drawn.',
      hint: 'If you are better, look for a new plan before repeating the same moves.',
    }
  }

  return {
    result: 'Game over.',
    lesson: 'This game reached an ending condition.',
    hint: 'Review the final position and name the main idea before starting the next game.',
  }
}

export default function ChessGame() {
  const chessRef = useRef(new Chess())
  const workerRef = useRef<Worker | null>(null)
  const analysisResolveRef = useRef<((analysis: StockfishAnalysis) => void) | null>(null)
  const isAnalyzingRef = useRef(false)
  const currentInfoRef = useRef<StockfishAnalysis>({})
  const [fen, setFen] = useState(chessRef.current.fen())
  const [orientation] = useState<'white' | 'black'>('white')
  const [engineReady, setEngineReady] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('Preparing tutor...')
  const [gameOver, setGameOver] = useState(false)
  const [gameOverMessage, setGameOverMessage] = useState<string | null>(null)
  const [gameOverDetails, setGameOverDetails] = useState<GameOverDetails | null>(null)
  const [showGameOverModal, setShowGameOverModal] = useState(false)
  const [modal, setModal] = useState<ModalState | null>(null)

  function updateGameState(game = chessRef.current) {
    const isOver = game.isGameOver()
    setGameOver(isOver)

    if (!isOver) {
      setGameOverMessage(null)
      setGameOverDetails(null)
      setShowGameOverModal(false)
      return
    }

    const details = buildGameOverDetails(game)
    setGameOverDetails(details)
    setShowGameOverModal(true)

    if (game.isCheckmate()) {
      setGameOverMessage('Checkmate — game over.')
      setStatusMessage('Checkmate — game over.')
      return
    }

    if (game.isStalemate()) {
      setGameOverMessage('Stalemate — draw.')
      setStatusMessage('Stalemate — draw.')
      return
    }

    if (game.isInsufficientMaterial()) {
      setGameOverMessage('Draw by insufficient material.')
      setStatusMessage('Draw by insufficient material.')
      return
    }

    setGameOverMessage('Game over.')
    setStatusMessage('Game over.')
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('chess:fen')
      if (saved) {
        chessRef.current.load(saved)
        setFen(chessRef.current.fen())
        updateGameState(chessRef.current)
      }
    } catch (e) {
      // ignore invalid saved FEN
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('chess:fen', fen)
  }, [fen])

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setStatusMessage('Engine unavailable in this browser')
      setEngineReady(false)
      return
    }

    let worker: Worker | null = null

    try {
      worker = new Worker(engineUrl)
    } catch (error) {
      console.warn('Failed to start Stockfish worker:', error)
      setStatusMessage('Engine unavailable in this browser')
      setEngineReady(false)
      return
    }

    workerRef.current = worker
    worker.onmessage = event => {
      const text = String(event.data).trim()
      if (!text) return
      if (text === 'uciok') return
      if (text === 'readyok') {
        setEngineReady(true)
        setStatusMessage('Tutor ready')
        return
      }

      if (text.startsWith('info')) {
        const cpMatch = /score cp (-?\d+)/.exec(text)
        const mateMatch = /score mate (-?\d+)/.exec(text)
        const pvMatch = /pv (.+)$/.exec(text)
        if (cpMatch) currentInfoRef.current.scoreCp = Number(cpMatch[1])
        if (mateMatch) currentInfoRef.current.mate = Number(mateMatch[1])
        if (pvMatch) currentInfoRef.current.pv = pvMatch[1].split(' ')
        return
      }

      if (text.startsWith('bestmove')) {
        const moveMatch = /bestmove ([a-h][1-8][a-h][1-8][qnrb]?)/.exec(text)
        const bestMove = moveMatch ? moveMatch[1] : undefined
        const analysis = { ...currentInfoRef.current, bestMove }
        currentInfoRef.current = {}
        if (analysisResolveRef.current) {
          analysisResolveRef.current(analysis)
          analysisResolveRef.current = null
        }
      }
    }
    worker.onerror = event => {
      console.error('Stockfish worker error:', event)
      setStatusMessage('Engine failed to load')
      setEngineReady(false)
    }

    worker.onmessageerror = event => {
      console.error('Stockfish worker message error:', event)
      setStatusMessage('Engine failed to load')
      setEngineReady(false)
    }

    worker.postMessage('uci')
    worker.postMessage('setoption name Threads value 1')
    worker.postMessage('isready')
    worker.postMessage('ucinewgame')

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const sendEngineCommand = (cmd: string) => {
    workerRef.current?.postMessage(cmd)
  }

  function startNewGame() {
    chessRef.current.reset()
    const nextFen = chessRef.current.fen()
    setFen(nextFen)
    setGameOver(false)
    setGameOverMessage(null)
    setGameOverDetails(null)
    setShowGameOverModal(false)
    setModal(null)
    setStatusMessage(engineReady ? 'New game - you move first' : 'Preparing tutor...')
    sendEngineCommand('ucinewgame')
  }

  const analyzeFen = async (fenToAnalyze: string): Promise<StockfishAnalysis> => {
    if (!engineReady || !workerRef.current) {
      return {}
    }

    return new Promise(resolve => {
      analysisResolveRef.current = resolve
      currentInfoRef.current = {}
      sendEngineCommand(`position fen ${fenToAnalyze}`)
      sendEngineCommand(`go depth ${engineDepth}`)
    })
  }

  function saveMistakeRecord(record: MistakeRecord) {
    try {
      const raw = localStorage.getItem('chess:mistakes')
      const arr: MistakeRecord[] = raw ? JSON.parse(raw) : []
      arr.unshift(record)
      localStorage.setItem('chess:mistakes', JSON.stringify(arr.slice(0, 80)))
    } catch (e) {
      // ignore storage failures
    }
  }

  function generateBotMove() {
    if (chessRef.current.isGameOver()) return

    const moves = chessRef.current.moves({ verbose: true })
    if (moves.length === 0) return
    const safeMoves = moves.filter(move => {
      const copy = new Chess(chessRef.current.fen())
      copy.move({ from: move.from, to: move.to, promotion: 'q' })
      return !findHangingPiece(copy, copy.turn())
    })
    const choice = (safeMoves.length ? safeMoves : moves)[Math.floor(Math.random() * (safeMoves.length || moves.length))]
    chessRef.current.move({ from: choice.from, to: choice.to, promotion: 'q' })
    setFen(chessRef.current.fen())
    updateGameState(chessRef.current)
  }

  function getHintText(category: string, detail?: { square?: string; piece?: string; targetSquare?: string }, stage = 1) {
    return parseHint(category, detail, stage)
  }

  function detectMistake(
    beforeFen: string,
    afterFen: string,
    userMove: { from: string; to: string },
    beforeAnalysis: StockfishAnalysis,
    afterAnalysis: StockfishAnalysis
  ) {
    const before = new Chess(beforeFen)
    const after = new Chess(afterFen)
    const color = before.turn()
    const opponent = color === 'w' ? 'b' : 'w'

    const materialBefore = countMaterial(before, color)
    const materialAfter = countMaterial(after, color)
    if (materialAfter < materialBefore) {
      return {
        isMistake: true,
        category: 'bad_trade',
        explanation: 'Your move lost material. The tutor wants you to keep your pieces safe unless the trade improves your position.',
        detail: { square: `${userMove.to}`, piece: 'piece' },
      }
    }

    const hanging = findHangingPiece(after, color)
    if (hanging) {
      return {
        isMistake: true,
        category: 'hanging_piece',
        explanation: `Your ${hanging.piece} on ${hanging.square} can be captured next move. Keep your pieces defended.`,
        detail: { square: hanging.square, piece: hanging.piece },
      }
    }

    const freeCapture = findFreeCapture(before, color)
    if (freeCapture && `${freeCapture.from}${freeCapture.to}` !== `${userMove.from}${userMove.to}`) {
      return {
        isMistake: true,
        category: 'missed_capture',
        explanation: `You had a free capture on ${freeCapture.to}. Look for undefended enemy pieces before you move.`,
        detail: { targetSquare: freeCapture.to, piece: pieceName(freeCapture.captured.type) },
      }
    }

    if (afterAnalysis.mate && afterAnalysis.mate > 0) {
      return {
        isMistake: true,
        category: 'allowing_checkmate',
        explanation: 'Your opponent has a mate threat after this move. Try to keep your king safe and avoid leaving direct threats.',
        detail: {},
      }
    }

    if (beforeAnalysis.mate && beforeAnalysis.mate > 0 && beforeAnalysis.bestMove && `${beforeAnalysis.bestMove}` !== `${userMove.from}${userMove.to}`) {
      return {
        isMistake: true,
        category: 'missed_mate',
        explanation: 'There was a winning tactic available. The tutor wants you to spot quick finishes.',
        detail: {},
      }
    }

    if (beforeAnalysis.scoreCp !== undefined && beforeAnalysis.scoreCp >= 150 && beforeAnalysis.bestMove && `${beforeAnalysis.bestMove}` !== `${userMove.from}${userMove.to}`) {
      // Only interrupt for clear mistakes, not small differences.
      const scoreDelta = beforeAnalysis.scoreCp
      if (scoreDelta >= 250) {
        return {
          isMistake: true,
          category: 'bad_trade',
          explanation: 'You missed a stronger move that would keep your position safer. The tutor focuses on clear mistakes, not small move preferences.',
          detail: {},
        }
      }
    }

    return { isMistake: false }
  }

  async function processUserMove(source: string, target: string) {
    if (isAnalyzingRef.current) return

    const beforeFen = chessRef.current.fen()
    const move = chessRef.current.move({ from: source, to: target, promotion: 'q' })
    if (move === null) return

    const afterFen = chessRef.current.fen()
    setFen(afterFen)
    updateGameState(chessRef.current)
    if (chessRef.current.isGameOver()) {
      return
    }
    setStatusMessage('Analyzing move...')

    isAnalyzingRef.current = true
    setIsAnalyzing(true)
    const finishAnalysis = () => {
      isAnalyzingRef.current = false
      setIsAnalyzing(false)
    }

    // Stockfish handles searches one at a time. A concurrent request overwrites
    // analysisResolveRef and leaves the first Promise unresolved.
    const beforeAnalysis = await analyzeFen(beforeFen).catch(() => ({}))
    const afterAnalysis = await analyzeFen(afterFen).catch(() => ({}))

    const result = detectMistake(beforeFen, afterFen, move, beforeAnalysis, afterAnalysis)
    if (result.isMistake) {
      const categoryInfo = categoryMap[result.category] || { label: result.category, concept: 'Learning' }
      const record: MistakeRecord = {
        id: `${Date.now()}-${source}-${target}`,
        position: beforeFen,
        playedMove: `${move.from}${move.to}`,
        bestMove: beforeAnalysis.bestMove || null,
        mistakeCategory: categoryInfo.label,
        concept: categoryInfo.concept,
        explanation: result.explanation,
        date: new Date().toISOString(),
        resolved: false,
      }
      saveMistakeRecord(record)
      setModal({
        beforeFen,
        afterFen,
        userMove: `${move.from}${move.to}`,
        explanation: result.explanation,
        bestMove: record.bestMove,
        category: result.category,
        concept: categoryInfo.concept,
        detail: result.detail,
        hintStage: 0,
        showAnswer: false,
      })
      setStatusMessage('Mistake detected')
      finishAnalysis()
      return
    }

    if (chessRef.current.isGameOver()) {
      finishAnalysis()
      return
    }

    setStatusMessage('Good move — continue playing')
    setTimeout(() => {
      if (!chessRef.current.isGameOver()) {
        generateBotMove()
      }
      finishAnalysis()
    }, 300)
  }

  function onPieceDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (gameOver || isAnalyzing || !targetSquare) return false

    const before = new Chess(chessRef.current.fen())
    const validation = before.move({ from: sourceSquare, to: targetSquare, promotion: 'q' })
    if (validation === null) return false

    try {
      processUserMove(sourceSquare, targetSquare).catch(() => {
        // keep the move on the board even if analysis fails
      })
    } catch (error) {
      console.warn('Move processing failed:', error)
    }
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
              onPieceDrop,
              boardWidth: Math.min(480, Math.max(320, typeof window !== 'undefined' ? window.innerWidth - 40 : 480)),
            }}
          />
        </div>
      </div>
      <div className="status">
        <p>{engineReady ? 'Stockfish is ready.' : 'Loading engine...'}</p>
        <p>{gameOverMessage || statusMessage}</p>
        <p>FEN: {fen}</p>
      </div>
      {showGameOverModal && gameOverDetails && !modal && (
        <GameOverModal
          result={gameOverDetails.result}
          lesson={gameOverDetails.lesson}
          hint={gameOverDetails.hint}
          onNewGame={startNewGame}
          onClose={() => setShowGameOverModal(false)}
        />
      )}
      {modal && (
        <MistakeModal
          category={modal.category}
          concept={modal.concept}
          explanation={modal.explanation}
          hint={getHintText(modal.category, modal.detail, modal.hintStage + 1)}
          showAnswer={modal.showAnswer}
          bestMove={modal.bestMove}
          onRetry={() => {
            chessRef.current.load(modal.beforeFen)
            setFen(modal.beforeFen)
            setModal(null)
            setStatusMessage('Try the position again')
          }}
          onHint={() => {
            setModal(modal => {
              if (!modal) return modal
              return { ...modal, hintStage: Math.min(modal.hintStage + 1, 3) }
            })
          }}
          onShow={() => {
            setModal(modal => (modal ? { ...modal, showAnswer: true } : modal))
          }}
          onContinue={() => {
            setModal(null)
            setTimeout(() => {
              if (!chessRef.current.isGameOver()) {
                generateBotMove()
              }
            }, 200)
          }}
        />
      )}
    </div>
  )
}
