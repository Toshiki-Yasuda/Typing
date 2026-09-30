import { playOnce } from '@/sound/oneshot';
import type { Settings } from '@/settings/settings';
import type { Theme } from '@/themes/theme';

interface Props {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  audio: NonNullable<Theme['audio']>;
}

const GAME_BGM_LABELS: Readonly<Record<Settings['gameBgm'], string>> = {
  off: '鳴らさない',
  boss: 'ボス戦だけ',
  all: 'すべての練習',
};

/** 音量つまみ。数値も文字で出す（色や位置だけに頼らない） */
function Volume({
  label,
  value,
  onChange,
  onRelease,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  onRelease?: () => void;
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-text-muted">{label}</span>
      <input
        type="range"
        aria-label={label}
        min={0}
        max={100}
        step={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        aria-valuetext={`${value}%`}
        className="w-48 accent-[var(--color-accent)]"
      />
      <output className="w-12 tabular-nums">{value}%</output>
    </label>
  );
}

/** 音の設定（BGM・効果音の入切と音量、練習中の BGM）。テーマに音があるときだけ出す */
export function AudioSettings({ settings, update, audio }: Props) {
  return (
    <section aria-labelledby="audio" className="card flex flex-col gap-3">
      <h2 id="audio" className="card-title">
        音
      </h2>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.bgm}
          onChange={(e) => update({ bgm: e.target.checked })}
          className="h-4 w-4 accent-[var(--viz-series-1)]"
        />
        <span>BGM を鳴らす</span>
      </label>
      {settings.bgm && (
        <Volume label="BGM の音量" value={settings.bgmVolume} onChange={(v) => update({ bgmVolume: v })} />
      )}
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={settings.sound}
          onChange={(e) => update({ sound: e.target.checked })}
          className="h-4 w-4 accent-[var(--viz-series-1)]"
        />
        <span>効果音を鳴らす</span>
      </label>
      {settings.sound && (
        <Volume
          label="効果音の音量"
          value={settings.sfxVolume}
          onChange={(v) => update({ sfxVolume: v })}
          // つまみを離したときに、今の音量で 1 回鳴らして確かめられるようにする
          onRelease={() => playOnce(audio.confirm, settings.sfxVolume / 100)}
        />
      )}
      {settings.bgm && audio.game && (
        <label className="flex items-center gap-2">
          <span className="text-text-muted">練習中の BGM</span>
          <select
            aria-label="練習中の BGM"
            value={settings.gameBgm}
            onChange={(e) => update({ gameBgm: e.target.value as Settings['gameBgm'] })}
            className="rounded bg-surface-raised px-3 py-2"
          >
            {(Object.keys(GAME_BGM_LABELS) as Settings['gameBgm'][]).map((k) => (
              <option key={k} value={k}>
                {GAME_BGM_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="text-sm text-text-muted">
        BGM は、タイトルとステージ選択で流れます。練習中は集中のため、既定ではボス戦だけです。打鍵の判定や計測には影響しません。
      </p>
    </section>
  );
}
