# Chess Trainer

A local-first chess practice app for playing full games against a deliberately simple bot. Its purpose is to pause at clear, teachable mistakes rather than to give a post-game engine review.

## How a turn works

The player plays White. After each legal move, the app:

1. Saves the position before and after the move.
2. Runs the conservative mistake detectors below.
3. If a meaningful mistake is confirmed, pauses the game and records it in browser `localStorage`.
4. Otherwise, lets the bot make its move.

The current game position is also stored locally, so reopening the app restores the last board position.

## Mistake detection

The tutor is intentionally conservative: it looks for immediate material consequences and mate in one, not opening preferences or small engine-evaluation changes.

### Concrete exchange check

For a candidate capture or an opponent reply, the app calculates a short exchange:

```text
move → opponent's best immediate capture → player's best immediate capture
```

It uses legal moves from `chess.js`, so illegal recaptures caused by check or pins are excluded. This shallow material check is a first filter, not a complete tactical search.

### Detectors

- **Missed mate**: the player had a legal mate in one and played a different move.
- **Allowed mate**: the player's move gives the opponent a legal mate in one.
- **Unsafe capture**: the player captured something, but the opponent's immediate reply leaves the player at least two material points worse off.
- **Hanging piece**: the move newly exposes the player's queen, rook, bishop, or knight to an immediate capture that cannot be recovered without losing at least two material points.
- **Missed free capture**: the app considers captures of an enemy queen, rook, bishop, or knight. It only flags one when its concrete exchange result is at least two points better than the move the player actually made.

Only severity 2 and 3 findings interrupt the game. Pawns alone do not create a missed-free-capture alert.

### Stockfish's role

Stockfish is a validator, not the source of the lesson. It searches at depth 10 and never interrupts merely because the player did not choose the engine's top move.

- For a suspected hanging piece or unsafe capture, it compares the evaluation before and after the played move. A sacrifice that retains sufficient compensation is dismissed.
- For a suspected missed capture, it compares the resulting position after that specific capture with the resulting position after the move actually played. The alert is kept only when the capture is clearly better (at least 1.5 pawns).
- If Stockfish cannot evaluate both positions for a missed-capture comparison, the app does not show that missed-capture modal.

Engine scores are not shown in the UI.

### Current limitations

The initial material filter only looks one reply and one recapture ahead. Stockfish reduces false positives in the cases above, but the tutor does not yet explicitly explain or detect deeper tactics such as intermediate moves, forks, pins, skewers, or long forcing combinations.

## Bot behaviour

The bot is not currently driven by Stockfish. On its turn it:

1. Generates all legal moves using `chess.js`.
2. Removes moves that immediately create an unsafe capture or newly hang a valuable piece under the same short exchange rules used by the tutor.
3. Picks randomly from the remaining moves.
4. Falls back to a random legal move if every move appears unsafe.

This makes the bot intentionally weak and varied, but it is not strategically strong and does not have distinct skill levels yet.

## User level and progression

The app does **not** currently estimate a user level, use Elo, adapt the bot to the player, or select lessons based on skill. Mistakes are stored locally and can be reviewed, but they do not yet change the bot or generate new practice positions.

## Local data

- `chess:fen`: the latest game position.
- `chess:mistakes`: up to 80 recorded mistake entries, including the original position, move, category, explanation, and date.

## Next steps

1. Add repeatable position tests for safe non-optimal moves, poisoned captures, neutral exchanges, unsafe captures, intentional sacrifices, and mate-in-one cases.
2. Improve the exchange evaluator so it can follow forcing recaptures beyond one reply and one recapture.
3. Add beginner-friendly explanations that reveal the answer only after a hint or retry.
4. Build personalised practice positions from the user’s saved mistake categories instead of only reopening the original position.
5. Track recurring mistake patterns and use them to adjust bot difficulty and practice emphasis.
6. Add explicit bot levels: obvious mistakes, basic play, and stronger tactical play.
