export interface Player {
  id: string;
  game_id: string;
  name: string;
  team: 'A' | 'B';
  flight: number;
  sort_order: number;
}

export interface Score {
  id: string;
  game_id: string;
  player_id: string;
  hole: number;
  strokes: number;
}

export interface HoleResult {
  hole: number;
  bestA: number | null;
  bestB: number | null;
  shotTeam: 'A' | 'B' | null;
  winner: 'A' | 'B' | 'halved';
  runningA: number;
  runningB: number;
}

export interface MatchResult {
  teamAPoints: number;
  teamBPoints: number;
  holeResults: (HoleResult | null)[];
  shotTeam: 'A' | 'B' | null;
}

export type ScoresByHole = Record<number, Record<string, number>>;

export function buildScoresByHole(scores: Score[]): ScoresByHole {
  const result: ScoresByHole = {};
  for (const s of scores) {
    if (!result[s.hole]) result[s.hole] = {};
    result[s.hole][s.player_id] = s.strokes;
  }
  return result;
}

export function getBestBall(
  players: Player[],
  holeScores: Record<string, number>,
  team: 'A' | 'B'
): number | null {
  let best: number | null = null;
  for (const p of players) {
    if (p.team !== team) continue;
    const strokes = holeScores[p.id];
    if (strokes != null && (best === null || strokes < best)) {
      best = strokes;
    }
  }
  return best;
}

/**
 * Resolve a hole winner.
 * Shot rule: when trailing team has a shot, tied = trailing team wins,
 * leading team must win by 2 strokes.
 */
function resolveHole(
  bestA: number,
  bestB: number,
  shotTeam: 'A' | 'B' | null
): 'A' | 'B' | 'halved' {
  const diff = bestA - bestB; // negative = A better, positive = B better

  if (shotTeam === null) {
    if (diff < 0) return 'A';
    if (diff > 0) return 'B';
    return 'halved';
  }

  if (shotTeam === 'A') {
    // Team A is trailing and has the shot
    if (diff <= 0) return 'A'; // tied or A better = A wins
    if (diff >= 2) return 'B'; // B wins by 2+
    return 'halved'; // B up by 1, not enough
  }

  // shotTeam === 'B'
  // Team B is trailing and has the shot
  if (diff >= 0) return 'B'; // tied or B better = B wins
  if (diff <= -2) return 'A'; // A wins by 2+
  return 'halved'; // A up by 1, not enough
}

export function calculateMatch(
  players: Player[],
  scoresByHole: ScoresByHole
): MatchResult {
  const holeResults: (HoleResult | null)[] = [];
  let runningA = 0;
  let runningB = 0;

  for (let hole = 1; hole <= 18; hole++) {
    const holeScores = scoresByHole[hole];
    if (!holeScores) {
      holeResults.push(null);
      continue;
    }

    const bestA = getBestBall(players, holeScores, 'A');
    const bestB = getBestBall(players, holeScores, 'B');

    if (bestA === null || bestB === null) {
      holeResults.push(null);
      continue;
    }

    // Determine if trailing team has a shot before this hole
    const diff = runningA - runningB;
    const shotTeam: 'A' | 'B' | null =
      Math.abs(diff) >= 2 ? (diff > 0 ? 'B' : 'A') : null;

    const winner = resolveHole(bestA, bestB, shotTeam);
    if (winner === 'A') runningA++;
    if (winner === 'B') runningB++;

    holeResults.push({
      hole,
      bestA,
      bestB,
      shotTeam,
      winner,
      runningA,
      runningB,
    });
  }

  const currentDiff = runningA - runningB;
  const currentShotTeam: 'A' | 'B' | null =
    Math.abs(currentDiff) >= 2 ? (currentDiff > 0 ? 'B' : 'A') : null;

  return {
    teamAPoints: runningA,
    teamBPoints: runningB,
    holeResults,
    shotTeam: currentShotTeam,
  };
}
