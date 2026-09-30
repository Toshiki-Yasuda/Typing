import { useState, type FormEvent } from 'react';
import { applyTheme } from '@/themes/apply';
import { THEMES, resolveTheme } from '@/themes/themes';
import { checkPassword, loadUnlocked, saveUnlocked } from '@/themes/unlock';
import { EFFECT_LABELS, EFFECT_LEVELS, type EffectLevel } from '@/effects/level';
import type { Theme } from '@/themes/theme';
import type { Settings } from '@/settings/settings';

interface Props {
  themeId: string;
  effects: EffectLevel;
  /** テーマを選んだ（解除した）直後。入口のあるテーマなら、呼び出し側が入口へ送る */
  onChosen?: (theme: Theme) => void;
  update: (patch: Partial<Settings>) => void;
}

/** テーマの選択。ロック中のテーマは、パスワードを入れると選べる */
export function ThemeSettings({ themeId, effects, onChosen, update }: Props) {
  const [unlocked, setUnlocked] = useState(() => loadUnlocked());
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const current = resolveTheme(themeId, unlocked);
  const locked = THEMES.filter((t) => t.locked && !unlocked.has(t.id));

  const choose = (id: string) => {
    update({ themeId: id });
    const chosen = resolveTheme(id, unlocked);
    applyTheme(chosen);
    onChosen?.(chosen);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    for (const theme of locked) {
      if (await checkPassword(theme.id, password)) {
        const next = new Set(unlocked).add(theme.id);
        saveUnlocked(next);
        setUnlocked(next);
        setPassword('');
        setError(false);
        update({ themeId: theme.id });
        const chosen = resolveTheme(theme.id, next);
        applyTheme(chosen);
        onChosen?.(chosen);
        return;
      }
    }
    setError(true);
  };

  return (
    <section aria-labelledby="theme" className="card flex flex-col gap-3">
      <h2 id="theme" className="card-title">
        テーマ
      </h2>
      {current.strings.tagline && <p className="text-text-muted">{current.strings.tagline}</p>}
      <label className="flex items-center gap-2">
        <span className="text-text-muted">テーマ</span>
        <select
          aria-label="テーマ"
          value={current.id}
          onChange={(e) => choose(e.target.value)}
          className="rounded bg-surface-raised px-3 py-2"
        >
          {THEMES.filter((t) => !t.locked || unlocked.has(t.id)).map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      {current.hero && (
        <label className="flex items-center gap-2">
          <span className="text-text-muted">演出</span>
          <select
            aria-label="演出"
            value={effects}
            onChange={(e) => update({ effects: e.target.value as EffectLevel })}
            className="rounded bg-surface-raised px-3 py-2"
          >
            {EFFECT_LEVELS.map((l) => (
              <option key={l} value={l}>
                {EFFECT_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
      )}
      {locked.length > 0 && (
        <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2">
            <span className="text-text-muted">パスワードで新しいテーマを開く</span>
            <input
              type="password"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={error}
              aria-describedby={error ? 'theme-error' : undefined}
              className="rounded bg-surface-raised px-3 py-2"
            />
          </label>
          <button type="submit" className="rounded bg-surface-raised px-4 py-2 font-bold">
            開く
          </button>
          {error && (
            <p id="theme-error" role="alert" className="text-danger">
              パスワードが違います。
            </p>
          )}
        </form>
      )}
    </section>
  );
}
