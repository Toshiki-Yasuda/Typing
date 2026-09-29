import type { SessionRecord } from '@/metrics';
import { ImportError, migrateExport } from './migrate';
import { CURRENT_SCHEMA_VERSION, ExportSchema } from './schema';

export function exportSessions(sessions: readonly SessionRecord[], now: number = Date.now()): string {
  return JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION, exportedAt: now, sessions }, null, 2);
}

/** エクスポートされた JSON を検証して読み込む。不正なら ImportError */
export function parseExport(json: string): SessionRecord[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new ImportError('JSON として読み込めません');
  }
  const parsed = ExportSchema.safeParse(migrateExport(raw));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ImportError(`データが不正です: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim());
  }
  return parsed.data.sessions;
}
