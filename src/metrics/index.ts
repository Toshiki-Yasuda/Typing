export { PAUSE_MS, cleanPairs, computeMetrics } from './compute';
export { recordPress } from './recorder';
export type { RecordedPress } from './recorder';
export { bigramStats, confusionMatrix, keyStats } from './stats';
export {
  aggregate,
  currentStreak,
  dayKey,
  mergeBigramStats,
  mergeKeyStats,
  summarizeSessions,
  withinDays,
} from './history';
export type { Aggregate, Confusion, SessionSummary } from './history';
export { keyWeakness } from './weakness';
export type { WeaknessOptions } from './weakness';
export type { BigramStat, KeyStat } from './stats';
export type { Keystroke, Metrics, SessionRecord } from './types';
