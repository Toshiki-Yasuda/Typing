import { Link } from 'react-router';
import { RANK_MIN_ACCURACY, type SessionSummary } from '@/metrics';
import { recommendation } from '@/session/recommendation';
import { useSettings } from '@/settings/useSettings';
import { resolveTheme } from '@/themes/themes';
import { loadUnlocked } from '@/themes/unlock';
import { trainLabels } from './labels';

/**
 * 練習の推奨を 1 行で。仕様は docs/spec/recommendation.md。
 * 結果画面（current あり）では、丁寧さの提案だけを、今回の練習自体が基準未満のときに出す（毎回の助言にしない）。
 */
export function RecommendationNote({ summaries, current }: { summaries: readonly SessionSummary[]; current?: SessionSummary }) {
  const [settings] = useSettings();
  const rec = recommendation(summaries);
  if (!rec) return null;
  // 速さの提案は、直近がすべて基準以上なので、今回も基準以上になり、ここで出なくなる
  if (current && current.accuracy >= RANK_MIN_ACCURACY) return null;
  const name = trainLabels(resolveTheme(settings.themeId, loadUnlocked())).names[rec.train];
  return (
    <section aria-label="練習の提案" className="card flex flex-col gap-1 !border-accent">
      <p>
        <span className="mr-2 font-bold">{rec.kind === 'careful' ? '提案：丁寧に' : '提案：速さに挑戦'}</span>
        {rec.message}
      </p>
      <Link to={`/train/${rec.train}`} className="self-start text-accent underline">
        修行「{name}」へ
      </Link>
    </section>
  );
}
