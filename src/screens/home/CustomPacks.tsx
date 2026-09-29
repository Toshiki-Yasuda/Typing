import { useRef } from 'react';
import type { ContentPack } from '@/content';
import type { ImportState } from './useCustomPacks';

interface Props {
  packs: readonly ContentPack[];
  state: ImportState;
  onImport: (file: File) => void;
  onRemove: (id: string) => void;
}

/** 表示する問題の最大数（多すぎると読めない。全件は取り込み前に直してもらう） */
const MAX_PROBLEMS = 10;

export function CustomPacks({ packs, state, onImport, onRemove }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <section aria-labelledby="custom-packs" className="flex flex-col gap-2">
      <h2 id="custom-packs" className="text-lg font-bold">
        自作パック
      </h2>
      <p className="text-sm text-text-muted">
        JSON（<code className="font-mono">{'{ "id", "name", "items": [{ "display", "reading" }] }'}</code>）を取り込めます。
        読み（reading）はひらがな・英数記号で、打てない文字や重複があれば取り込まずに理由を示します。
      </p>
      <div>
        <button type="button" onClick={() => fileInput.current?.click()} className="rounded bg-surface-raised px-4 py-2">
          パックを取り込む
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          aria-label="取り込むパックのファイル"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = '';
          }}
        />
      </div>
      {state.kind !== 'idle' && (
        <div role="status" className={state.kind === 'error' ? 'rounded bg-danger/20 p-3' : undefined}>
          <p>{state.message}</p>
          {state.problems.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-sm">
              {state.problems.slice(0, MAX_PROBLEMS).map((p, i) => (
                <li key={i}>{p}</li>
              ))}
              {state.problems.length > MAX_PROBLEMS && <li>…ほか {state.problems.length - MAX_PROBLEMS} 件</li>}
            </ul>
          )}
        </div>
      )}
      {packs.length > 0 && (
        <ul className="flex flex-col gap-1">
          {packs.map((p) => (
            <li key={p.id} className="flex items-center gap-3">
              <span>
                {p.name} <span className="text-text-muted">（{p.items.length}語・{p.id}）</span>
              </span>
              <button
                type="button"
                onClick={() => onRemove(p.id)}
                aria-label={`${p.name}を削除`}
                className="rounded bg-surface-raised px-2 py-1 text-sm"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
