Project: Personal Chess Learning Trainer (Mobile Web App)

Goal

Build a personal chess practice app designed around my preferred learning style:

* I learn best through immediate feedback.
* I do not retain mistakes from post-game analysis alone.
* I want to learn through full games first, not random chess puzzles.
* The app should identify recurring mistakes and deliberately create practice opportunities for those mistakes.

The goal is not to build a chess platform. The goal is to build a personal adaptive tutor.

⸻

Core Learning Loop

The user flow should be:

1. Start a full chess game against an easy bot.
2. User makes moves normally.
3. After each user move:
    * Analyse whether the move is a meaningful mistake.
    * If yes, pause the game.
    * Explain the mistake in beginner-friendly language.
    * Allow the user to retry or continue.
4. Record the mistake type.
5. Later create practice games/positions that repeat the same concept.

⸻

Version 1 Scope (keep simple)

Must have

1. Mobile chess board

Requirements:

* Designed primarily for phone screens.
* Large board.
* Touch-friendly.
* Drag pieces or tap-to-move.

Use an existing chessboard component rather than building one.

Recommended:

* react-chessboard for the UI. It provides a responsive React chessboard component with mobile support.
    * https://www.npmjs.com/package/react-chessboard

⸻

2. Chess rules engine

Use chess.js.

Responsibilities:

* Validate legal moves.
* Track game state.
* Generate FEN positions.
* Detect check/checkmate/stalemate.

Do not implement chess rules manually.

Reference:

* https://www.npmjs.com/package/chess.js

⸻

3. Computer opponent

Use Stockfish.

The bot should initially play intentionally weak chess.

Difficulty levels:

* Level 1: makes obvious mistakes.
* Level 2: plays basic chess.
* Level 3: stronger.

Do not expose Elo initially.

Reference:

* https://github.com/official-stockfish/Stockfish

⸻

Mistake Detection

Do not show raw engine evaluations.

Bad:
“You lost 2.3 evaluation points.”

Good:
“You moved your knight and left your queen undefended.”

Initial mistake categories:

Hanging pieces

Examples:

* Leaving queen/rook/bishop/knight capturable.
* Missing that opponent attacks a piece.

Ignoring threats

Examples:

* Opponent attacks queen.
* Opponent threatens checkmate.

Bad trades

Examples:

* Trading when losing material.
* Avoiding obvious winning trades.

Missing free captures

Moving pieces repeatedly instead of developing

⸻

Feedback UI

When a mistake occurs:

Show:

⸻

⚠️ Pause

Your move was legal, but there was a problem.

You moved your bishop here.

Your opponent can now:

* capture it
* win material

Before continuing:

What did you miss?

[Retry move]

[Show explanation]

⸻

Do not immediately reveal the answer.

The user should think first.

⸻

Learning Memory System

Store mistakes locally.

No backend needed initially.

Example:

{
mistakeType: “missed_knight_attack”,
position: “FEN”,
userMove: “Qd4”,
bestMove: “Qe2”,
date: “2026-07-13”,
solved: false
}

⸻

Practice Mode

Create a “Review my mistakes” mode.

Instead of random puzzles:

Generate scenarios based on previous games.

Example:

The user repeatedly loses queens to knights.

Create:

* Different board positions
* Different openings
* Same underlying skill

Goal:

Train recognition, not memorisation.

⸻

Progression System

Do not use rating as the main metric.

Track skills:

Example:

Piece safety:
⭐⭐⭐☆☆

Opening principles:
⭐⭐☆☆☆

Tactics:
⭐☆☆☆☆

Endgames:
⭐⭐⭐☆☆

Only increase bot difficulty when the user consistently avoids major mistakes.

⸻

Do NOT build initially

Avoid:

* User accounts
* Multiplayer
* Friends
* Leaderboards
* Opening database
* Puzzle database
* Fancy animations
* Social features
* Backend

The app should work offline if possible.

⸻

Suggested Tech Stack

Frontend:

* React + TypeScript
* Vite
* Tailwind CSS

Chess:

* chess.js
* react-chessboard

AI:

* Stockfish running locally/in browser

Storage:

* LocalStorage initially

Deployment:

* GitHub Pages or Vercel

⸻

Development Milestones

Milestone 1

A mobile chess board where:

* User plays against bot.
* Game works.

Milestone 2

Add Stockfish analysis:

* Detect bad moves.

Milestone 3

Add explanations:

* Convert engine output into beginner language.

Milestone 4

Save mistakes.

Milestone 5

Generate personalised practice.

⸻

Design inspiration

The UI should feel closer to:

* Sudoku app
* Duolingo skill progression
* A chess coach sitting beside you

Not:

* Chess.com competitive interface

The user should always know:
“What am I learning from this move?”