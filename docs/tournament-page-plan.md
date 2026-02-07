# Tournament Page Concept + Build Plan

## Goals

- Add a dedicated tournament page where multiple network entrants can play organized events.
- Support entrant instances (same network allowed multiple times) as long as temperature differs.
- Support a `Best-of` setting so each pairing in a round can play multiple games.
- Run rounds like real tournaments: do not start round N+1 until all games in round N are complete.
- Show all games for the current round in one screen view.
- Allow opening a running/completed game in read-only detail mode with move history, PGN, and both engines' W/D/L evaluations for live and historical positions.
- Show live standings throughout the event.

## Recommended Formats

### 1) Round Robin (MVP format)

Why:
- Best baseline for small-to-medium entrant counts.
- Every entrant plays every other entrant (clear standings, easy to understand).
- Naturally round-based and fits your "wait for full round completion" requirement.

Rules:
- Single round robin by default.
- Optional double round robin (swap colors) as a later enhancement.
- Odd entrant count uses a BYE.
- Each pairing can be expanded to `Best-of N` games via slider (default `1`).

### 2) Swiss (Phase 2)

Why:
- Scales to larger entrant pools without O(n^2) games.
- Round-based and standings-driven.

Rules:
- User selects number of rounds.
- Pair by score groups, avoid repeats, approximate color balancing.
- Tiebreakers: Buchholz, then Sonneborn-like fallback.
- Each Swiss pairing can be expanded to `Best-of N` games in that round.

### 3) Single Elimination (Phase 3)

Why:
- Fast tournament completion and clear bracket narrative.
- Easy to display as a bracket page variant.

Rules:
- Seeding by rating or random.
- `Best-of N` slider controls games per bracket node.

## UX: Page Structure

## Setup Screen

- `Format` selector: `Round Robin`, `Swiss`, `Single Elimination`.
- `Entrants` editor table:
  - network picker
  - temperature input
  - optional custom label
  - add/remove entrant instance
  - duplicate network allowed only if temperature differs
- `Tournament Settings`:
  - rounds (for Swiss)
  - best-of slider (any integer, minimum `1`)
  - max simultaneous games
  - optional random seed
- Validation summary:
  - min entrants per format
  - duplicate `(networkId, temperature)` detection
  - estimated game count and estimated rounds
- `Start Tournament` button

## Live Tournament Screen

- Header: format, current round, progress (`finished games / total games`), pause/resume.
- Main grid: all games of current round displayed at once as cards.
  - card states: `waiting`, `running`, `finished`
  - only up to `maxSimultaneousGames` run concurrently
  - remaining games stay visible as queued
- Right panel: live standings table.
- Round barrier behavior:
  - when all games in round finish, compute standings + next round pairings
  - then start next round

## Game Detail Screen (from clicking any game card)

- Reuse game-view components where possible, but fully read-only:
  - board
  - move list with history navigation
  - PGN tab
- Evaluation panel shows both engines:
  - White engine W/D/L (from white perspective)
  - Black engine W/D/L (also normalized to white perspective for comparison)
- Historical navigation:
  - selecting a past move shows both engines' evaluations for that historical position
  - if missing, show loading and backfill from eval queue

## Core Data Model (TypeScript)

```ts
export type TournamentFormat = 'round_robin' | 'swiss' | 'single_elim';

export interface TournamentSettings {
  rounds?: number; // swiss only
  bestOf: number; // integer >= 1
  maxSimultaneousGames: number;
  seed?: number;
}

export interface TournamentEntrant {
  id: string; // unique instance id
  networkId: string;
  networkName: string;
  networkFile: string;
  temperature: number;
  label: string; // e.g. "Maia 1500 @ 0.40"
  seed?: number;
}

export interface MatchEvalSnapshot {
  ply: number; // -1 start position, 0..N-1 after each move
  fen: string;
  whiteEngineWdl: [number, number, number]; // white/draw/black from white perspective
  blackEngineWdl: [number, number, number]; // white/draw/black from white perspective
  status: 'ready' | 'pending' | 'error';
}

export interface TournamentMatch {
  id: string;
  seriesId: string; // all games belonging to one pairing in a round
  seriesGameIndex: number; // 1..bestOf
  round: number;
  board: number;
  whiteEntrantId: string;
  blackEntrantId: string;
  status: 'waiting' | 'running' | 'finished' | 'error';
  result: '1-0' | '0-1' | '1/2-1/2' | '*';
  moves: string[]; // SAN
  fenHistory: string[];
  evalHistory: MatchEvalSnapshot[];
  pgn: string;
  startedAt?: string;
  endedAt?: string;
}

export interface StandingRow {
  entrantId: string;
  matchPoints: number;
  gamePoints: number;
  wins: number;
  draws: number;
  losses: number;
  sb?: number; // Sonneborn-Berger
  buchholz?: number;
}
```

## Scheduling + Execution Model

### Round Generation

- Round Robin:
  - precompute all rounds with Berger tables.
  - for each pairing, emit `bestOf` games as one series.
- Swiss:
  - generate round pairings after each round from current standings.
  - expand each pairing into `bestOf` games as one series.
- Single Elim:
  - precompute bracket rounds from seeded entrants.
  - each bracket node runs a `bestOf` series.

### Round Runner

- For each round:
  - render every match card immediately.
  - place all matches in round queue.
  - start up to `maxSimultaneousGames` matches.
  - as a match finishes, start next queued match in same round.
  - when queue empty and all running matches complete -> round complete.
- Only then compute next round and continue.
- If `bestOf > 1`, all series games are still part of the same round barrier.
- If planned games end tied, auto-add sudden-death tiebreak games until series winner emerges.

## Engine and Evaluation Strategy

- Each running match uses two engine instances (white + black entrants).
- Reuse cached ONNX model data from existing model cache path.
- Add non-moving eval call to worker API:
  - new worker request: `evaluatePosition` -> returns W/D/L only.
  - needed for historical "both engines at same position".
- For each position snapshot (start + each ply), store both engines' W/D/L.
- Normalize all W/D/L to white perspective in UI.

## Standings Rules

- Scoring by series (Best-of):
  - series win = 1 match point
  - series loss = 0 match points
- Secondary tiebreak from underlying game points:
  - game win = 1, draw = 0.5, loss = 0
- Round Robin tiebreak order:
  1. match points
  2. game points
  3. Sonneborn-Berger
  4. head-to-head (if applicable)
- Swiss tiebreak order:
  1. match points
  2. game points
  3. Buchholz
  4. Sonneborn-like secondary

## Proposed File/Module Plan

- `src/types/tournament.ts`
  - tournament domain types
- `src/lib/tournament/pairings.ts`
  - round robin, swiss, elimination pairing generators
- `src/lib/tournament/standings.ts`
  - standings + tiebreak calculations
- `src/lib/tournament/pgn.ts`
  - PGN generation for tournament matches
- `src/hooks/useTournamentRunner.ts`
  - queueing, round barriers, match lifecycle
- `src/components/tournament/TournamentSetupScreen.tsx`
- `src/components/tournament/TournamentLiveScreen.tsx`
- `src/components/tournament/TournamentGameDetailScreen.tsx`
- `src/components/tournament/StandingsTable.tsx`
- `src/components/tournament/RoundGamesGrid.tsx`
- `src/components/tournament/EntrantsEditor.tsx`
- `src/App.tsx`
  - add page routing/state for Home/Game/Tournament

## Rollout Plan

### Phase 1 (MVP)

- Dedicated tournament page.
- Round robin only.
- Entrant instances with distinct temperature.
- Best-of slider (any integer >= 1) applied to each round pairing.
- Round runner with max simultaneous games and strict round barrier.
- Live standings + clickable game detail (read-only board, moves, PGN).
- Live eval for both engines on current position.

### Phase 2

- Historical dual-engine eval snapshots for all plies.
- Swiss format.
- Persist/resume tournaments in local storage.

### Phase 3

- Single elimination bracket view.
- Double round robin option.
- Export all games PGN bundle + standings CSV.

## Key Risks + Mitigations

- Browser CPU/memory pressure with high concurrency.
  - Mitigation: hard cap `maxSimultaneousGames`, surface estimated resource usage.
- Long tournaments with many games.
  - Mitigation: periodic snapshot persistence and resume support.
- Swiss pairing edge cases.
  - Mitigation: deterministic greedy pairing first, then iterative improvement.

## Practical Defaults

- Default format: `Round Robin`.
- Default best-of: `1`.
- Default max simultaneous games: `2`.
- Default temperature precision: two decimals.
- Default standings sort: match points desc, then tiebreakers.
