import { CURRENT_SCHEMA_VERSION } from './schema';

export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportError';
  }
}

/** 版 n のデータを版 n+1 に変換する。キーは「変換元の版」 */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** 版が上がったらここに足す。例: `1: (d) => ({ ...d, schemaVersion: 2, ... })` */
export const MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v1 → v2: 記録に任意の vows（縛り）を足した。既存の記録はそのまま読める（版だけ上げる）
  1: (d) => ({ ...d, schemaVersion: 2 }),
};

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 古い版のエクスポートを最新の版まで順に移行する */
export function migrateExport(
  data: unknown,
  migrations: Readonly<Record<number, Migration>> = MIGRATIONS,
  current: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  if (!isRecord(data)) throw new ImportError('データの形式が正しくありません');
  let version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new ImportError('schemaVersion がありません');
  }
  if (version > current) {
    throw new ImportError(`新しい版（v${version}）のデータです。アプリを更新してください（対応: v${current}まで）`);
  }
  let out: Record<string, unknown> = data;
  while (version < current) {
    const step = migrations[version];
    if (!step) throw new ImportError(`v${version} からの移行手順がありません`);
    out = step(out);
    if (out.schemaVersion !== version + 1) throw new ImportError(`v${version} の移行結果の版が不正です`);
    version++;
  }
  return out;
}
