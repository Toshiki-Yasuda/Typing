import { z } from 'zod';
import type { SessionRecord } from '@/metrics';

/** 保存・エクスポート形式の版。形式を変えたら上げ、migrate.ts に移行を足す */
export const CURRENT_SCHEMA_VERSION = 1;

export const KeystrokeSchema = z.object({
  t: z.number().finite().nonnegative(),
  key: z.string().length(1),
  code: z.string(),
  expected: z.string().nullable(),
  correct: z.boolean(),
  item: z.number().int().nonnegative(),
});

export const SessionSchema = z.object({
  id: z.string().min(1),
  startedAt: z.number().int().nonnegative(),
  mode: z.string(),
  contentId: z.string(),
  targets: z.array(z.string()),
  engineVersion: z.string(),
  ruleVersion: z.string(),
  keystrokes: z.array(KeystrokeSchema),
});

export const ExportSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  exportedAt: z.number().int().nonnegative(),
  sessions: z.array(SessionSchema),
});

// スキーマと SessionRecord の型が食い違ったらコンパイルエラーにする（実行時には何も出力しない）
type Assert<T extends true> = T;
export type _SchemaMatchesRecord = Assert<z.infer<typeof SessionSchema> extends SessionRecord ? true : false>;
