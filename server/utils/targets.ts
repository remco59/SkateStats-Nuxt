import { openingSplitM, computeRaceMetrics } from './splits'
import { parseLapsToMs } from './time'
import { pythonRound } from '../../shared/utils/round'

/**
 * Target generation ported from app/main.py (old app, commit 4dc6959):
 * build_target_generator_profiles, generate_split_targets,
 * build_target_forecast. Pinned by
 * reference/fixtures/calculations/golden_calculations.json ->
 * target_generation.
 */

export interface ProfileRaceInput {
  id: number;
  distanceM: number;
  totalTimeMs: number | null;
  status: string;
  lapsCsv: string | null;
}

export interface DistanceProfile {
  sampleSize: number;
  openingRatio: number | null;
  last400Ratio: number | null;
  fadeRatio: number | null;
}

function mean(values: number[]): number | null {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}

/** Builds a per-distance pacing profile from the skater's own recent history (last 6 races per distance). */
export function buildTargetGeneratorProfiles(
  rows: ProfileRaceInput[],
): Map<number, DistanceProfile> {
  const grouped = new Map<number, ProfileRaceInput[]>();
  for (const row of rows) {
    if (row.totalTimeMs === null || row.status !== 'finished') continue;
    const { lapsMs } = parseLapsToMs(row.lapsCsv ?? '');
    if (!lapsMs.length) continue;
    const list = grouped.get(row.distanceM) ?? [];
    list.push(row);
    grouped.set(row.distanceM, list);
  }

  const profiles = new Map<number, DistanceProfile>();
  for (const [distance, distanceRows] of grouped) {
    const recentRows = distanceRows.slice(-6);
    const openingRatios: number[] = [];
    const last400Ratios: number[] = [];
    const fadeRatios: number[] = [];

    for (const row of recentRows) {
      const totalMs = row.totalTimeMs as number;
      const { lapsMs } = parseLapsToMs(row.lapsCsv ?? '');
      const laps = lapsMs.map((ms) => ms / 1000);
      if (!laps.length || totalMs <= 0) continue;
      const metrics = computeRaceMetrics(laps, distance);

      openingRatios.push(pythonRound(laps[0]! * 1000) / totalMs);
      if (metrics.last400Eq !== null) {
        last400Ratios.push((metrics.last400Eq * 1000) / totalMs);
      }
      if (metrics.fade400Eq !== null && metrics.avg400) {
        fadeRatios.push(metrics.fade400Eq / metrics.avg400);
      }
    }

    profiles.set(distance, {
      sampleSize: recentRows.length,
      openingRatio: mean(openingRatios),
      last400Ratio: mean(last400Ratios),
      fadeRatio: mean(fadeRatios),
    });
  }

  return profiles;
}

const OPENING_DEFAULTS: Record<number, number> = {
  100: 1.0,
  300: 0.34,
  500: 0.275,
  1000: 0.275,
  1500: 0.19,
  3000: 0.105,
  5000: 0.066,
  10000: 0.034,
};
const LAST_400_DEFAULTS: Record<number, number> = {
  100: 1.0,
  300: 1.0,
  500: 0.73,
  1000: 0.41,
  1500: 0.285,
  3000: 0.145,
  5000: 0.088,
  10000: 0.045,
};
const FADE_DEFAULTS: Record<number, number> = {
  100: 0.0,
  300: 0.02,
  500: 0.05,
  1000: 0.08,
  1500: 0.09,
  3000: 0.11,
  5000: 0.12,
  10000: 0.13,
};

export interface GeneratedSplitTargets {
  targetOpeningMs: number | null;
  targetAvg400Ms: number | null;
  targetLast400Ms: number | null;
  targetFade400Ms: number | null;
}

export function generateSplitTargets(
  distanceM: number,
  targetTimeMs: number | null,
  profile: DistanceProfile | null,
): GeneratedSplitTargets {
  if (targetTimeMs === null || targetTimeMs <= 0) {
    return {
      targetOpeningMs: null,
      targetAvg400Ms: null,
      targetLast400Ms: null,
      targetFade400Ms: null,
    };
  }

  const openingRatio =
    profile?.openingRatio ?? OPENING_DEFAULTS[distanceM] ?? 0.18;
  const last400Ratio =
    profile?.last400Ratio ?? LAST_400_DEFAULTS[distanceM] ?? 0.2;
  const fadeRatio = profile?.fadeRatio ?? FADE_DEFAULTS[distanceM] ?? 0.08;

  const targetOpeningMs = pythonRound(targetTimeMs * openingRatio);
  const remainingDistanceM = Math.max(distanceM - openingSplitM(distanceM), 0);
  const remainingTimeMs = Math.max(targetTimeMs - targetOpeningMs, 0);
  const targetAvg400Ms =
    remainingDistanceM > 0
      ? pythonRound((remainingTimeMs * 400) / remainingDistanceM)
      : null;
  const targetLast400Ms = pythonRound(targetTimeMs * last400Ratio);
  const targetFade400Ms =
    targetAvg400Ms !== null ? pythonRound(targetAvg400Ms * fadeRatio) : null;

  return {
    targetOpeningMs,
    targetAvg400Ms,
    targetLast400Ms,
    targetFade400Ms,
  };
}

export interface ForecastRaceInput {
  id: number;
  totalTimeMs: number | null;
  status: string;
  competitionDate: string;
}

export type TargetForecast =
  | { status: 'no_target' }
  | { status: 'no_data'; targetTimeMs: number }
  | {
      status: 'reached'
      targetTimeMs: number;
      bestTimeMs: number;
      deltaMs: number;
      bestRaceId: number;
    }
  | {
      status: 'insufficient'
      targetTimeMs: number;
      bestTimeMs: number;
      deltaMs: number;
    }
  | {
      status: 'flat'
      targetTimeMs: number;
      bestTimeMs: number;
      deltaMs: number;
      improvementPerRaceMs: number;
    }
  | {
      status: 'forecast'
      targetTimeMs: number;
      bestTimeMs: number;
      deltaMs: number;
      improvementPerRaceMs: number;
      racesToTarget: number;
      etaDate: string | null;
    };

export function buildTargetForecast(
  targetTimeMs: number | null,
  distanceRows: ForecastRaceInput[],
): TargetForecast {
  const timedRows = distanceRows.filter(
    (r) => r.totalTimeMs !== null && r.status === 'finished',
  );

  if (targetTimeMs === null) return { status: 'no_target' };
  if (!timedRows.length) return { status: 'no_data', targetTimeMs };

  const bestRow = [...timedRows].sort((a, b) =>
    a.totalTimeMs! !== b.totalTimeMs!
      ? a.totalTimeMs! - b.totalTimeMs!
      : a.id - b.id,
  )[0]!;
  const bestTimeMs = bestRow.totalTimeMs!;
  const deltaMs = bestTimeMs - targetTimeMs;

  if (deltaMs <= 0) {
    return {
      status: 'reached',
      targetTimeMs,
      bestTimeMs,
      deltaMs,
      bestRaceId: bestRow.id,
    };
  }

  const recentRows = timedRows.slice(-5);
  if (recentRows.length < 3) {
    return { status: 'insufficient', targetTimeMs, bestTimeMs, deltaMs };
  }

  const oldestMs = recentRows[0]!.totalTimeMs!;
  const latestMs = recentRows[recentRows.length - 1]!.totalTimeMs!;
  const improvementTotalMs = oldestMs - latestMs;
  const racesSpan = recentRows.length - 1;
  const improvementPerRaceMs =
    racesSpan > 0 ? improvementTotalMs / racesSpan : 0;

  if (improvementPerRaceMs <= 0) {
    return {
      status: 'flat',
      targetTimeMs,
      bestTimeMs,
      deltaMs,
      improvementPerRaceMs,
    };
  }

  const racesToTarget = Math.max(1, Math.ceil(deltaMs / improvementPerRaceMs));
  const latestDate = recentRows[recentRows.length - 1]!.competitionDate;
  let etaDate: string | null = null;
  if (latestDate) {
    const base = new Date(`${latestDate}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + racesToTarget * 14);
    etaDate = base.toISOString().slice(0, 10);
  }

  return {
    status: 'forecast',
    targetTimeMs,
    bestTimeMs,
    deltaMs,
    improvementPerRaceMs: pythonRound(improvementPerRaceMs),
    racesToTarget,
    etaDate,
  };
}
