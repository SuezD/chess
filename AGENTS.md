# AGENTS.md

## Project: Chess Tutor

A minimal mobile-first chess tutor web app.

The app teaches chess through full games, immediate feedback, and reviewing mistakes.

---

# Screens

The app has only two screens:

1. New Game
2. Review Mistakes

Do not add additional screens unless explicitly requested.

---

# New Game Screen

This is the main application screen.

Layout:

- Button to start a new game
- Button to navigate to Review Mistakes
- Chess board
- Tutor panel below the board


Nothing else should appear during normal gameplay.
Everything should fit on a single page (no vertical or horizontal scrolling needed)

No:
- ratings
- statistics
- dashboards
- move history
- captured pieces
- opening information
- leaderboards

---

# Chess Board

Use existing chess libraries.

Do not implement chess rules or a custom chess board.

Preferred:

- react-chessboard for board UI
- chess.js for chess state and legal moves
- Stockfish for bot decisions

The user controls only their own pieces.

The opponent pieces are controlled by the bot.

---

# Gameplay

Every game is a complete chess game.

The user does not play puzzles or isolated positions during normal play.

Starting a new game resets the current game.

Early progression:
- User always plays White.

Later progression:
- User learns Black as well.

The condition for switching colours must be based on stored user progress.

Do not add this until a clear progression rule exists.

---

# Bot

The opponent is always a bot.

Bot difficulty is not selected by the user.

The bot behaviour adapts based on user progress.

The goal of the bot is to create learning opportunities, not simply maximise winning chances.

---

# Mistake Detection

A mistake is a move that represents a clear learning opportunity.

Do not interrupt for:
- different opening choices
- non-optimal engine moves
- small evaluation changes
- positional preferences

Interrupt for:
- losing a piece immediately
- hanging a queen/rook/bishop/knight
- missing a forced capture
- allowing immediate checkmate
- missing immediate checkmate
- ignoring check
- obvious tactical losses

Mistake detection should prioritise teachable concepts over engine accuracy.

---

# Tutor Panel

The tutor panel is always visible below the board.

It provides passive information.

Examples:

Before a game:

"Focus: Piece Safety"

During a game:

"Look for threats before moving."

---

# Mistake Modal

When a mistake occurs:

Show a modal.

The modal contains:

- Explanation/hint
- Look Again button
- Hint button
- Show Answer button
- Continue Anyway button

Behaviour:

## Look Again
Undo the user's mistake move.

The user chooses another move.

## Hint
Show a stronger hint.

## Show Answer
Show the recommended move and explanation.

## Continue Anyway
Continue the game from the mistake position.

---

# Game Over

When checkmate occurs:

Show a game over modal.

Actions:

- New Game
- Review Mistakes

---

# User Progress

Progress is stored in local storage.

Progress determines:

- tutor behaviour
- bot behaviour
- lessons shown

Progress should be based on:

- number of mistakes
- mistake categories
- successful avoidance of previous mistakes

Do not use Elo.

---

# Mistake Storage

Store mistakes locally.

Each mistake should contain:

- game id
- timestamp
- FEN position before mistake
- user's move
- recommended move
- mistake category
- explanation
- whether user has successfully reviewed it

---

# Review Mistakes Screen

Purpose:

Allow users to practise previous mistakes.

Show a list of mistakes.

Each item should contain:

- mistake type
- short explanation
- date

Each mistake has:

Practice button

---

# Practice Mistakes

Clicking Practice:

- Returns user to the chess board.
- Loads the previous game state.
- Places the user at the mistake position.
- Allows them to continue the game from that point.

The user should replay from the mistake rather than solve a static puzzle.

---

# Mistake Retention

Initial implementation:

Keep all mistakes locally.

Do not delete automatically.

Future versions may introduce:
- spaced repetition
- solved mistakes
- forgetting old mistakes

---

# Technical Constraints

Mobile-first.

Should work as a PWA.

Prefer offline functionality.

Keep implementation simple.

Avoid unnecessary dependencies.

---

# Current Priority Order

1. Complete chess game against bot
2. Detect clear mistakes
3. Show mistake modal
4. Save mistakes
5. Review mistakes
6. Adapt tutor based on progress
