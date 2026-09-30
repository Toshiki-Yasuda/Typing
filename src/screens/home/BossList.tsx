import { useState } from 'react';
import { Link } from 'react-router';
import { medalText } from '@/session/vows';
import { loadBossProgress } from '@/session/bossProgress';
import { VowsPicker } from '../vows/VowsPicker';
import type { Boss } from '@/themes/theme';

/** ボス戦の一覧。戦績（挑戦回数・最高ランク）を文字で示す */
export function BossList({ bosses, isOpen }: { bosses: readonly Boss[]; isOpen: (bossId: string) => boolean }) {
  const [progress] = useState(() => loadBossProgress());
  return (
    <section aria-labelledby="bosses" className="card flex flex-col gap-3">
      <h2 id="bosses" className="card-title">
        ボス戦
      </h2>
      <p className="text-sm text-text-muted">
        苦手なキーを含むお題が多く出ます。ミスが許される回数を超えると敗北です。
      </p>
      <VowsPicker />
      <ul className="flex flex-col gap-2">
        {bosses.map((b) => {
          const p = progress[b.id];
          return (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-raised p-3">
              <div>
                <p className="font-bold">
                  第{b.chapter}章 {b.name}
                  <span className="ml-2 text-sm font-normal text-text-muted">{b.title}</span>
                </p>
                <p className="text-sm text-text-muted">
                  {b.words}語・ミスの余裕 {b.maxMisses}回・
                  {p ? `挑戦 ${p.attempts}回・最高ランク ${p.best ?? 'なし（未勝利）'}${p.bestVows ? `・${medalText(p.bestVows)}` : ''}` : '未挑戦'}
                  {b.timeLimitSec ? `・制限時間 ${b.timeLimitSec}秒` : ''}
                  {b.skill ? `・技「${b.skill.name}」` : ''}
                </p>
              </div>
              {isOpen(b.id) ? (
                <Link
                  to={`/boss/${b.id}`}
                  aria-label={`${b.name}に挑戦する`}
                  className="rounded bg-accent px-4 py-2 font-bold text-surface"
                >
                  挑戦する
                </Link>
              ) : (
                <span aria-disabled="true" className="rounded border border-dashed border-text-muted/40 px-4 py-2 text-sm text-text-muted">
                  🔒 その章のステージをすべてクリアで開く
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
