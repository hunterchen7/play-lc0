import type {
  StandingRow,
  TournamentEntrant,
  TournamentMatch,
  TournamentSeries,
} from "../../types/tournament";

interface CalculateStandingsArgs {
  entrants: TournamentEntrant[];
  series: TournamentSeries[];
  matchesById: Map<string, TournamentMatch>;
  byeMatchPoints?: Map<string, number>;
  byeGamePoints?: Map<string, number>;
}

export function calculateStandings({
  entrants,
  series,
  matchesById,
  byeMatchPoints,
  byeGamePoints,
}: CalculateStandingsArgs): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const opponents = new Map<string, string[]>();

  for (const entrant of entrants) {
    rows.set(entrant.id, {
      entrantId: entrant.id,
      label: entrant.label,
      matchPoints: byeMatchPoints?.get(entrant.id) ?? 0,
      gamePoints: byeGamePoints?.get(entrant.id) ?? 0,
      wins: 0,
      draws: 0,
      losses: 0,
      playedSeries: 0,
      buchholz: 0,
    });
    opponents.set(entrant.id, []);
  }

  for (const group of series) {
    const games = group.gameIds
      .map((id) => matchesById.get(id))
      .filter(
        (match): match is TournamentMatch =>
          !!match && match.status === "finished" && match.result !== "*",
      );

    if (games.length === 0) continue;

    const whiteRow = rows.get(group.whiteEntrantId);
    const blackRow = rows.get(group.blackEntrantId);
    if (!whiteRow || !blackRow) continue;

    opponents.get(group.whiteEntrantId)?.push(group.blackEntrantId);
    opponents.get(group.blackEntrantId)?.push(group.whiteEntrantId);

    for (const game of games) {
      if (game.result === "1-0") {
        whiteRow.gamePoints += 1;
      } else if (game.result === "0-1") {
        blackRow.gamePoints += 1;
      } else {
        whiteRow.gamePoints += 0.5;
        blackRow.gamePoints += 0.5;
      }
    }

    if (group.status !== "finished") continue;

    whiteRow.playedSeries += 1;
    blackRow.playedSeries += 1;

    if (group.winnerEntrantId === group.whiteEntrantId) {
      whiteRow.matchPoints += 1;
      whiteRow.wins += 1;
      blackRow.losses += 1;
    } else if (group.winnerEntrantId === group.blackEntrantId) {
      blackRow.matchPoints += 1;
      blackRow.wins += 1;
      whiteRow.losses += 1;
    } else {
      whiteRow.matchPoints += 0.5;
      blackRow.matchPoints += 0.5;
      whiteRow.draws += 1;
      blackRow.draws += 1;
    }
  }

  for (const row of rows.values()) {
    const opps = opponents.get(row.entrantId) ?? [];
    row.buchholz = opps.reduce(
      (sum, opponentId) => sum + (rows.get(opponentId)?.matchPoints ?? 0),
      0,
    );
  }

  return [...rows.values()].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) return b.matchPoints - a.matchPoints;
    if (b.gamePoints !== a.gamePoints) return b.gamePoints - a.gamePoints;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.label.localeCompare(b.label);
  });
}

export function buildColorBalance(
  matches: TournamentMatch[],
): Map<string, number> {
  const balance = new Map<string, number>();

  for (const match of matches) {
    if (match.status !== "finished" || match.result === "*") continue;
    balance.set(
      match.whiteEntrantId,
      (balance.get(match.whiteEntrantId) ?? 0) + 1,
    );
    balance.set(
      match.blackEntrantId,
      (balance.get(match.blackEntrantId) ?? 0) - 1,
    );
  }

  return balance;
}

export function buildOpponentsMap(
  series: TournamentSeries[],
  matchesById: Map<string, TournamentMatch>,
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();

  for (const group of series) {
    if (group.status !== "finished") {
      continue;
    }

    const games = group.gameIds
      .map((id) => matchesById.get(id))
      .filter(
        (match): match is TournamentMatch =>
          !!match && match.status === "finished" && match.result !== "*",
      );

    if (games.length === 0) {
      continue;
    }

    if (!map.has(group.whiteEntrantId)) map.set(group.whiteEntrantId, new Set());
    if (!map.has(group.blackEntrantId)) map.set(group.blackEntrantId, new Set());

    map.get(group.whiteEntrantId)?.add(group.blackEntrantId);
    map.get(group.blackEntrantId)?.add(group.whiteEntrantId);
  }

  return map;
}
