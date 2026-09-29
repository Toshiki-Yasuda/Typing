import { useState } from 'react';
import {
  MIN_SAMPLE,
  WEEKDAY_LABELS,
  bestBucket,
  byHour,
  byWeekday,
  valueOf,
  type SessionSummary,
  type TimeMetric,
} from '@/metrics';
import { ColumnChart } from './ColumnChart';

const METRICS: Record<TimeMetric, { label: string; header: string; format: (v: number) => string }> = {
  kpm: { label: '速度', header: '平均速度（打鍵/分）', format: (v) => v.toFixed(0) },
  miss: { label: 'ミス率', header: '平均ミス率', format: (v) => `${(v * 100).toFixed(1)}%` },
};

/**
 * 時間帯・曜日ごとの成績。回数が少ない区分は参考値として区別する。
 * ミス率を使うのは、正確率だと 95〜100% に偏り、ゼロ基準の棒では差が見えないため。
 */
export function TimeOfDay({ summaries }: { summaries: readonly SessionSummary[] }) {
  const [metric, setMetric] = useState<TimeMetric>('kpm');
  const m = METRICS[metric];
  const hours = byHour(summaries);
  const weekdays = byWeekday(summaries);

  const bestHour = bestBucket(hours, metric);
  const bestDay = bestBucket(weekdays, metric);
  const insight = (label: string, best: typeof bestHour, unit: string) =>
    best ? `${label}: ${unit === '時' ? `${best.index}時台` : `${WEEKDAY_LABELS[best.index]}曜日`}（${m.format(valueOf(best, metric) as number)}・${best.count}回）` : null;

  return (
    <section aria-labelledby="time-of-day" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 id="time-of-day" className="text-xl font-bold">
          時間帯と曜日
        </h2>
        <span role="group" aria-label="指標" className="flex gap-1 text-sm">
          {(Object.keys(METRICS) as TimeMetric[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={metric === k}
              onClick={() => setMetric(k)}
              className={`rounded px-3 py-1 ${metric === k ? 'bg-accent text-surface' : 'bg-surface-raised'}`}
            >
              {METRICS[k].label}
            </button>
          ))}
        </span>
      </div>

      <p className="text-sm text-text-muted" role="status">
        {insight(metric === 'kpm' ? '速度が高い時間帯' : 'ミスが少ない時間帯', bestHour, '時') ??
          `比べられる時間帯がまだ少ないため、傾向は出せません（${MIN_SAMPLE} 回以上の時間帯が 2 つ以上必要です）。`}
        {bestDay && (
          <>
            <br />
            {insight(metric === 'kpm' ? '速度が高い曜日' : 'ミスが少ない曜日', bestDay, '曜')}
          </>
        )}
      </p>

      <ColumnChart
        title={`時間帯別の${m.label}`}
        columns={hours.map((b) => ({ label: `${b.index}`, name: `${b.index}時台`, value: valueOf(b, metric), count: b.count }))}
        format={m.format}
        valueHeader={m.header}
        minSample={MIN_SAMPLE}
        labelEvery={3}
      />
      <ColumnChart
        title={`曜日別の${m.label}`}
        columns={weekdays.map((b) => ({
          label: WEEKDAY_LABELS[b.index] as string,
          name: `${WEEKDAY_LABELS[b.index]}曜日`,
          value: valueOf(b, metric),
          count: b.count,
        }))}
        format={m.format}
        valueHeader={m.header}
        minSample={MIN_SAMPLE}
      />
    </section>
  );
}
