/**
 * 生成ツール（普段は実行されない）: Ver1 の語彙から、ステージの語彙パックとチャプター定義を作る。
 *
 *   python3 art/hunter/extract_ver1_words.py <Ver1 のリポジトリ> /tmp/ver1-words.json
 *   GEN_STAGES=/tmp/ver1-words.json npx vitest run src/content/genStages.test.ts
 *
 * 出力: public/themes/hunter/stages/c{章}s{ステージ}.json（ステージ 6 は、その章のボスの出題）と、
 *       src/themes/hunterChapters.ts（生成物。手で編集しない）。取り除いた語は /tmp/ver1-dropped.txt に出す。
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildStagePack, type Dropped, type RawWord } from './stageBuild';

interface RawStage {
  number: number;
  name: string;
  description: string;
  words: RawWord[];
}
interface RawChapter {
  number: number;
  title: string;
  subtitle: string;
  stages: RawStage[];
}

const input = process.env.GEN_STAGES;

describe.skipIf(!input)('ステージの語彙を生成する', () => {
  it('Ver1 の語彙から、検証済みのパックを書き出す', () => {
    const { chapters } = JSON.parse(readFileSync(input as string, 'utf8')) as { chapters: RawChapter[] };
    const dir = 'public/themes/hunter/stages';
    mkdirSync(dir, { recursive: true });
    const report: string[] = [];
    const meta = chapters.map((ch) => {
      const stages = ch.stages.map((st) => {
        const id = `c${ch.number}s${st.number}`;
        const { pack, dropped } = buildStagePack(id, `${ch.title} ${st.number}: ${st.name}`, st.words);
        writeFileSync(`${dir}/${id}.json`, JSON.stringify(pack, null, 1) + '\n');
        dropped.forEach((d: Dropped) => report.push(`${id}\t${d.word.display}\t${d.word.reading}\t${d.reason}`));
        return { id, name: st.name, description: st.description, pack: `themes/hunter/stages/${id}.json`, words: pack.items.length };
      });
      return { ch, stages };
    });
    const lines = meta.map(({ ch, stages }) => {
      const practice = stages.slice(0, -1); // 最後のステージ（総合チャレンジ）は、その章のボスの出題
      const items = practice
        .map((s) => `      { id: '${s.id}', name: '${s.name}', description: '${s.description}', pack: '${s.pack}' },`)
        .join('\n');
      return `  {\n    id: 'c${ch.number}',\n    number: ${ch.number},\n    title: '${ch.title}',\n    subtitle: '${ch.subtitle}',\n    boss: 'chapter${ch.number}',\n    stages: [\n${items}\n    ],\n  },`;
    });
    writeFileSync(
      'src/themes/hunterChapters.ts',
      `// 生成物: src/content/genStages.test.ts（GEN_STAGES）。手で編集しない。\n// Ver1 の 7 章 × 5 ステージ。各章の 6 番目（総合チャレンジ）はボスの出題（themes/hunter/stages/c{章}s6.json）。\nimport type { Chapter } from './theme';\n\nexport const HUNTER_CHAPTERS: Chapter[] = [\n${lines.join('\n')}\n];\n`,
    );
    writeFileSync('/tmp/ver1-dropped.txt', report.join('\n') + '\n');
    console.warn(`章 ${meta.length}・ステージ ${meta.reduce((n, m) => n + m.stages.length, 0)}・除いた語 ${report.length}`);
    expect(meta.length).toBe(7);
  });
});
