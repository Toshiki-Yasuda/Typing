import { normalizeTarget, validateTarget } from '@/engine';
import type { ContentItem, ContentPack } from './schema';

export interface RawWord {
  readonly display: string;
  readonly reading: string;
}

export interface Dropped {
  readonly word: RawWord;
  readonly reason: string;
}

const MAX_LEN = 40;

/**
 * 外部（Ver1）の語彙から、出題パックを作る。
 * 読みを正規化し、打てない語・長すぎる語・読みの重複を取り除く（取り除いた語と理由も返す）。
 * 出題データは「全語が打てる・重複が無い」が前提なので（CLAUDE.md）、機械で確かめられる範囲はここで保証する。
 */
export function buildStagePack(
  id: string,
  name: string,
  raw: readonly RawWord[],
): { pack: ContentPack; dropped: Dropped[] } {
  const items: ContentItem[] = [];
  const dropped: Dropped[] = [];
  const seen = new Set<string>();
  for (const word of raw) {
    const reading = normalizeTarget(word.reading.trim());
    const display = word.display.trim();
    const drop = (reason: string) => dropped.push({ word, reason });
    if (reading === '' || display === '') drop('空');
    else if (reading.length > MAX_LEN || display.length > MAX_LEN) drop(`長すぎる（${MAX_LEN}文字まで）`);
    else {
      const v = validateTarget(reading);
      if (!v.ok) drop(`打てない文字がある（${v.unsupported.join('')}）`);
      else if (seen.has(reading)) drop('読みが重複');
      else {
        seen.add(reading);
        items.push({ display, reading });
      }
    }
  }
  return { pack: { id, name, items }, dropped };
}
