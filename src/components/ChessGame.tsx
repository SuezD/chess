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

type MistakeCategory = 'hanging_piece' | 'unsafe_capture' | 'missed_capture' | 'missed_mate' | 'allowing_checkmate'

type DetectedMistake = {
  category: MistakeCategory
  severity: 1 | 2 | 3
  confidence: number
  alternativeFen?: string
  alternativeMove?: string
  evidence: {
    square?: string
    piece?: string
    targetSquare?: string
    opponentMove?: string
  }
}

const engineUrl = '/stockfish/stockfish-18-asm.js?engine=v2'
const engineDepth = 10
const pieceValues: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 }

const categoryMap: Record<string, { label: string; concept: string }> = {
  bad_trade: { label: 'Bad trade', concept: 'Winning Material' },
  hanging_piece: { label: 'Hanging piece', concept: 'Piece Safety' },
  unsafe_capture: { label: 'Unsafe capture', concept: 'Piece Safety' },
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
  unsafe_capture: [
    'Before taking, check what your opponent can capture next.',
    'Does your capture leave a more valuable piece exposed?',
    'This capture loses more material than it wins.',
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

function opponentOf(color: string) {
  return color === 'w' ? 'b' : 'w'
}

function isCapture(move: { flags: string }) {
  return move.flags.includes('c') || move.flags.includes('e')
}

function playMove(game: Chess, move: { from: string; to: string; promotion?: string }) {
  const next = new Chess(game.fen())
  const promotion = move.promotion as 'n' | 'b' | 'r' | 'q' | undefined
  next.move(promotion
    ? { from: move.from, to: move.to, promotion }
    : { from: move.from, to: move.to })
  return next
}

function materialBalance(game: Chess, color: string) {
  return countMaterial(game, color) - countMaterial(game, opponentOf(color))
}

function positionWithTurn(game: Chess, color: string) {
  const fenParts = game.fen().split(' ')
  fenParts[1] = color
  return new Chess(fenParts.join(' '))
}

function bestImmediateRecovery(game: Chess, color: string) {
  let bestBalance = materialBalance(game, color)
  for (const move of game.moves({ verbose: true }).filter(isCapture)) {
    bestBalance = Math.max(bestBalance, materialBalance(playMove(game, move), color))
  }
  return bestBalance
}

// This is intentionally only one opponent reply and one possible recapture. It
// catches clear losses while avoiding a full engine search or a top-move comparison.
function worstImmediateExchange(game: Chess, playerColor: string) {
  const replies = game.moves({ verbose: true }).filter(isCapture)
  let worstBalance = materialBalance(game, playerColor)
  let worstMove: { from: string; to: string; captured?: string } | null = null

  for (const reply of replies) {
    const afterReply = playMove(game, reply)
    const balanceAfterRecovery = bestImmediateRecovery(afterReply, playerColor)
    if (!worstMove || balanceAfterRecovery < worstBalance) {
      worstBalance = balanceAfterRecovery
      worstMove = reply
    }
  }

  return { balance: worstBalance, reply: worstMove }
}

function findMateInOne(game: Chess) {
  for (const move of game.moves({ verbose: true })) {
    if (playMove(game, move).isCheckmate()) return move
  }
  return null
}

function findUnsafeCapture(after: Chess, playerColor: string, balanceBefore: number): DetectedMistake | null {
  const outcome = worstImmediateExchange(after, playerColor)
  const materialLoss = balanceBefore - outcome.balance
  if (!outcome.reply || materialLoss < 2) return null

  return {
    category: 'unsafe_capture',
    severity: materialLoss >= 5 ? 3 : 2,
    confidence: 0.9,
    evidence: {
      square: outcome.reply.to,
      piece: pieceName(outcome.reply.captured || null),
      opponentMove: `${outcome.reply.from}${outcome.reply.to}`,
    },
  }
}

function findNewHangingPiece(before: Chess, after: Chess, playerColor: string, balanceBefore: number): DetectedMistake | null {
  const previouslyCapturableSquares = new Set(
    positionWithTurn(before, opponentOf(playerColor)).moves({ verbose: true }).filter(isCapture).map(move => move.to)
  )
  const valuablePieces = new Set(['q', 'r', 'b', 'n'])
  let strongest: DetectedMistake | null = null

  for (const reply of after.moves({ verbose: true }).filter(isCapture)) {
    if (!reply.captured || !valuablePieces.has(reply.captured) || previouslyCapturableSquares.has(reply.to)) continue

    const afterReply = playMove(after, reply)
    const loss = balanceBefore - bestImmediateRecovery(afterReply, playerColor)
    if (loss < 2) continue

    const severity: 2 | 3 = reply.captured === 'q' || loss >= 5 ? 3 : 2
    if (!strongest || severity > strongest.severity) {
      strongest = {
        category: 'hanging_piece',
        severity,
        confidence: 0.9,
        evidence: {
          square: reply.to,
          piece: pieceName(reply.captured),
          opponentMove: `${reply.from}${reply.to}`,
        },
      }
    }
  }

  return strongest
}

function findMissedFreeCapture(before: Chess, after: Chess, playerColor: string, balanceBefore: number) {
  const valuablePieces = new Set(['q', 'r', 'b', 'n'])
  const playedOutcome = worstImmediateExchange(after, playerColor)
  const playedGain = playedOutcome.balance - balanceBefore
  let best: DetectedMistake | null = null

  for (const capture of before.moves({ verbose: true }).filter(isCapture)) {
    if (!capture.captured || !valuablePieces.has(capture.captured)) continue

    const candidatePosition = playMove(before, capture)
    const outcome = worstImmediateExchange(candidatePosition, playerColor)
    const gain = outcome.balance - balanceBefore
    // A capture is only "missed" if it beats the move that was actually
    // played. This prevents treating every favourable capture as mandatory.
    if (gain < 2 || gain - playedGain < 2) continue

    const severity: 2 | 3 = capture.captured === 'q' || gain >= 5 ? 3 : 2
    if (!best || severity > best.severity) {
      best = {
        category: 'missed_capture',
        severity,
        confidence: 0.9,
        alternativeFen: candidatePosition.fen(),
        alternativeMove: `${capture.from}${capture.to}`,
        evidence: {
          targetSquare: capture.to,
          piece: pieceName(capture.captured),
        },
      }
    }
  }

  return best
}

function describeMistake(mistake: DetectedMistake) {
  const { evidence } = mistake
  switch (mistake.category) {
    case 'unsafe_capture':
      return `That capture allows your opponent to take your ${evidence.piece || 'piece'} on ${evidence.square}. You lose more material than you win.`
    case 'hanging_piece':
      return `Your ${evidence.piece || 'piece'} on ${evidence.square} can be taken next move, and the exchange loses material.`
    case 'missed_capture':
      return `You could safely take the opponent's ${evidence.piece || 'piece'} on ${evidence.targetSquare}.`
    case 'allowing_checkmate':
      return 'Your opponent has a checkmate in one after this move.'
    case 'missed_mate':
      return 'You had a checkmate in one available.'
  }
}

function engineConfirmsMaterialMistake(before: StockfishAnalysis, after: StockfishAnalysis) {
  // UCI scores are from the side-to-move perspective. Before the move that is
  // the player; after the move it is the opponent, so the latter is inverted.
  if (after.mate !== undefined) return after.mate > 0
  if (before.scoreCp === undefined || after.scoreCp === undefined) return true

  const evaluationLoss = before.scoreCp - (-after.scoreCp)
  return evaluationLoss >= 120
}

function scoreForPlayerWhenOpponentToMove(analysis: StockfishAnalysis) {
  if (analysis.mate !== undefined) {
    return analysis.mate > 0
      ? -100_000 + analysis.mate
      : 100_000 + analysis.mate
  }
  return analysis.scoreCp === undefined ? undefined : -analysis.scoreCp
}

function engineConfirmsMissedCapture(candidate: StockfishAnalysis, played: StockfishAnalysis) {
  const candidateScore = scoreForPlayerWhenOpponentToMove(candidate)
  const playedScore = scoreForPlayerWhenOpponentToMove(played)
  // Missed captures are opportunity comparisons, so fail closed when the
  // engine cannot validate both resulting positions.
  if (candidateScore === undefined || playedScore === undefined) return false
  return candidateScore - playedScore >= 150
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
  const boardWrapRef = useRef<HTMLDivElement | null>(null)
  const analysisResolveRef = useRef<((analysis: StockfishAnalysis) => void) | null>(null)
  const isAnalyzingRef = useRef(false)
  const currentInfoRef = useRef<StockfishAnalysis>({})
  const [fen, setFen] = useState(chessRef.current.fen())
  const [boardWidth, setBoardWidth] = useState(0)
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
    const element = boardWrapRef.current
    if (!element) return

    const updateBoardWidth = () => {
      setBoardWidth(Math.floor(Math.min(480, element.clientWidth)))
    }

    updateBoardWidth()
    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(updateBoardWidth)
    observer?.observe(element)
    window.addEventListener('resize', updateBoardWidth)

    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateBoardWidth)
    }
  }, [])

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
      const before = new Chess(chessRef.current.fen())
      const copy = playMove(before, move)
      const botColor = before.turn()
      const balanceBefore = materialBalance(before, botColor)
      const unsafeCapture = move.captured ? findUnsafeCapture(copy, botColor, balanceBefore) : null
      return !unsafeCapture && !findNewHangingPiece(before, copy, botColor, balanceBefore)
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
    userMove: { from: string; to: string; captured?: string }
  ) {
    const before = new Chess(beforeFen)
    const after = new Chess(afterFen)
    const color = before.turn()
    const balanceBefore = materialBalance(before, color)
    const mistakes: DetectedMistake[] = []

    const missedMate = findMateInOne(before)
    if (missedMate && `${missedMate.from}${missedMate.to}` !== `${userMove.from}${userMove.to}`) {
      mistakes.push({ category: 'missed_mate', severity: 3, confidence: 1, evidence: {} })
    }

    if (findMateInOne(after)) {
      mistakes.push({ category: 'allowing_checkmate', severity: 3, confidence: 1, evidence: {} })
    }

    if (userMove.captured) {
      const unsafeCapture = findUnsafeCapture(after, color, balanceBefore)
      if (unsafeCapture) mistakes.push(unsafeCapture)
    }

    const hangingPiece = findNewHangingPiece(before, after, color, balanceBefore)
    if (hangingPiece) mistakes.push(hangingPiece)

    const missedCapture = findMissedFreeCapture(before, after, color, balanceBefore)
    if (missedCapture) mistakes.push(missedCapture)

    mistakes.sort((a, b) => b.severity - a.severity || b.confidence - a.confidence)
    return mistakes[0] || null
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

    let result = detectMistake(beforeFen, afterFen, move)
    if (
      result &&
      (result.category === 'hanging_piece' || result.category === 'unsafe_capture') &&
      engineReady
    ) {
      // This validates the consequence of a tentative material loss. It does
      // not compare the played move with Stockfish's preferred move.
      const beforeAnalysis = await analyzeFen(beforeFen).catch(() => ({}))
      const afterAnalysis = await analyzeFen(afterFen).catch(() => ({}))
      if (!engineConfirmsMaterialMistake(beforeAnalysis, afterAnalysis)) {
        result = null
      }
    }

    if (result?.category === 'missed_capture' && (!result.alternativeFen || !engineReady)) {
      result = null
    } else if (result?.category === 'missed_capture' && result.alternativeFen) {
      // Both positions are after White's move, so Stockfish is evaluating from
      // the same (opponent-to-move) perspective. This compares a concrete
      // capture with the played move, never with Stockfish's top choice.
      const captureAnalysis = await analyzeFen(result.alternativeFen).catch(() => ({}))
      const playedAnalysis = await analyzeFen(afterFen).catch(() => ({}))
      if (!engineConfirmsMissedCapture(captureAnalysis, playedAnalysis)) {
        result = null
      }
    }

    if (result && result.severity >= 2) {
      const categoryInfo = categoryMap[result.category] || { label: result.category, concept: 'Learning' }
      const explanation = describeMistake(result)
      const record: MistakeRecord = {
        id: `${Date.now()}-${source}-${target}`,
        position: beforeFen,
        playedMove: `${move.from}${move.to}`,
        bestMove: result.alternativeMove || null,
        mistakeCategory: categoryInfo.label,
        concept: categoryInfo.concept,
        explanation,
        date: new Date().toISOString(),
        resolved: false,
      }
      saveMistakeRecord(record)
      setModal({
        beforeFen,
        afterFen,
        userMove: `${move.from}${move.to}`,
        explanation,
        bestMove: record.bestMove,
        category: result.category,
        concept: categoryInfo.concept,
        detail: result.evidence,
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
      <div className="board-wrap" ref={boardWrapRef}>
        <div className="board">
          {boardWidth > 0 && (
            <Chessboard
              options={{
                position: fen,
                boardOrientation: orientation,
                onPieceDrop,
                boardWidth,
              }}
            />
          )}
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
