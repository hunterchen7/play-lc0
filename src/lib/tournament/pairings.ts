import type { StandingRow, TournamentPairing } from "../../types/tournament";

const BYE = "__bye__";

interface SwissPairingArgs {
  entrantIds: string[];
  standings: StandingRow[];
  previousOpponents: Map<string, Set<string>>;
  byeRecipients: Set<string>;
  colorBalance: Map<string, number>;
}

export function generateRoundRobinPairings(
  entrantIds: string[],
): TournamentPairing[][] {
  if (entrantIds.length < 2) return [];

  const players = [...entrantIds];
  if (players.length % 2 === 1) {
    players.push(BYE);
  }

  const rounds: TournamentPairing[][] = [];
  const n = players.length;
  const half = n / 2;

  for (let roundIndex = 0; roundIndex < n - 1; roundIndex++) {
    const round: TournamentPairing[] = [];

    for (let i = 0; i < half; i++) {
      const a = players[i];
      const b = players[n - 1 - i];

      if (a === BYE || b === BYE) {
        continue;
      }

      let whiteEntrantId = a;
      let blackEntrantId = b;

      if (roundIndex % 2 === 1) {
        [whiteEntrantId, blackEntrantId] = [blackEntrantId, whiteEntrantId];
      }
      if (i % 2 === 1) {
        [whiteEntrantId, blackEntrantId] = [blackEntrantId, whiteEntrantId];
      }

      round.push({ whiteEntrantId, blackEntrantId });
    }

    rounds.push(round);

    const fixed = players[0];
    const rotating = players.slice(1);
    rotating.unshift(rotating.pop() as string);
    players.splice(0, players.length, fixed, ...rotating);
  }

  return rounds;
}

export function generateSwissRoundPairings({
  entrantIds,
  standings,
  previousOpponents,
  byeRecipients,
  colorBalance,
}: SwissPairingArgs): { pairings: TournamentPairing[]; byeEntrantId?: string } {
  const scoreByEntrant = new Map(
    standings.map((row) => [
      row.entrantId,
      {
        matchPoints: row.matchPoints,
        gamePoints: row.gamePoints,
        buchholz: row.buchholz,
      },
    ]),
  );

  const ordered = [...entrantIds].sort((a, b) => {
    const as = scoreByEntrant.get(a) ?? {
      matchPoints: 0,
      gamePoints: 0,
      buchholz: 0,
    };
    const bs = scoreByEntrant.get(b) ?? {
      matchPoints: 0,
      gamePoints: 0,
      buchholz: 0,
    };

    if (bs.matchPoints !== as.matchPoints) return bs.matchPoints - as.matchPoints;
    if (bs.gamePoints !== as.gamePoints) return bs.gamePoints - as.gamePoints;
    if (bs.buchholz !== as.buchholz) return bs.buchholz - as.buchholz;
    return a.localeCompare(b);
  });

  let byeEntrantId: string | undefined;
  const pool = [...ordered];

  if (pool.length % 2 === 1) {
    let byeIdx = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!byeRecipients.has(pool[i])) {
        byeIdx = i;
        break;
      }
    }
    if (byeIdx === -1) {
      byeIdx = pool.length - 1;
    }
    byeEntrantId = pool.splice(byeIdx, 1)[0];
  }

  const pairings: TournamentPairing[] = [];

  while (pool.length > 1) {
    const a = pool.shift() as string;
    const played = previousOpponents.get(a) ?? new Set<string>();

    let candidateIdx = pool.findIndex((id) => !played.has(id));
    if (candidateIdx === -1) {
      candidateIdx = 0;
    }

    const b = pool.splice(candidateIdx, 1)[0];
    pairings.push(assignColors(a, b, colorBalance));
  }

  return { pairings, byeEntrantId };
}

function assignColors(
  entrantA: string,
  entrantB: string,
  colorBalance: Map<string, number>,
): TournamentPairing {
  const balanceA = colorBalance.get(entrantA) ?? 0;
  const balanceB = colorBalance.get(entrantB) ?? 0;

  if (balanceA > balanceB) {
    return { whiteEntrantId: entrantB, blackEntrantId: entrantA };
  }
  if (balanceB > balanceA) {
    return { whiteEntrantId: entrantA, blackEntrantId: entrantB };
  }

  if (entrantA.localeCompare(entrantB) <= 0) {
    return { whiteEntrantId: entrantA, blackEntrantId: entrantB };
  }

  return { whiteEntrantId: entrantB, blackEntrantId: entrantA };
}
