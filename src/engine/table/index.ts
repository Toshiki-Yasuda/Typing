import { buildRomajiTable } from './build';
import { parseMozcTable } from './parse';
import mozcText from './mozc/romanji-hiragana.tsv?raw';

export type { RomajiTable, SokuonDoubling } from './build';
export { buildRomajiTable, classifyRows } from './build';
export { parseMozcTable } from './parse';
export type { MozcRow } from './parse';
export { EXCLUDED_ROWS, PREFERRED_KEYS } from './rules';

export const MOZC_ROWS = parseMozcTable(mozcText);
export const ROMAJI_TABLE = buildRomajiTable(MOZC_ROWS);
