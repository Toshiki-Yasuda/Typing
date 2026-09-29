import basicJson from './packs/basic.json';
import englishJson from './packs/english.json';
import symbolsJson from './packs/symbols.json';
import { loadPack } from './schema';

export { ContentPackSchema, loadPack, validatePackContent } from './schema';
export type { ContentItem, ContentPack } from './schema';

export const BASIC_PACK = loadPack(basicJson);
export const ENGLISH_PACK = loadPack(englishJson);
export const SYMBOLS_PACK = loadPack(symbolsJson);

/** 組み込みのパック。読み込み時に全語が打てることを検証している */
export const BUILTIN_PACKS = [BASIC_PACK, ENGLISH_PACK, SYMBOLS_PACK] as const;
