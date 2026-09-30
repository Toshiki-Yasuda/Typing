import { Link } from 'react-router';
import type { SessionRecord } from '@/metrics';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { wordsCompleted, zetsuRank, type TrainKind } from '@/session/training';
import { trainLabels } from './labels';

/** 修行の結果。型ごとの指標を、文字で示す（絶: ミスの段階／練: 打ち切った語数／発: 技の名前） */
export function TrainResultPanel({ kind, record, misses }: { kind: TrainKind; record: SessionRecord; misses: number }) {
  const [settings] = useSettings();
  const labels = trainLabels(resolveTheme(settings.themeId, loadUnlocked()));
  const name = labels.names[kind];
  return (
    <section aria-labelledby="train-result" className="flex flex-col gap-2 rounded-lg bg-surface-raised p-4">
      <h2 id="train-result" className="text-lg font-bold">
        修行の結果：{name}
      </h2>
      {kind === 'zetsu' && (
        <p>
          段階 <strong>{zetsuRank(misses)}</strong>（ミス {misses} 回。S:0 / A:1〜2 / B:3〜5 / C:6〜）
        </p>
      )}
      {kind === 'ren' && (
        <p>
          60 秒で <strong>{wordsCompleted(record.keystrokes)} 語</strong>を打ち切りました。
        </p>
      )}
      {kind === 'hatsu' && <p>弱いキーを多く含む語で練習しました。ミス {misses} 回。</p>}
      <p>
        <Link to={`/train/${kind}`} className="underline">
          もう一度{name}
        </Link>
        {' ・ '}
        <Link to="/train" className="underline">
          修行の一覧へ
        </Link>
      </p>
    </section>
  );
}
