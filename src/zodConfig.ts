import { z } from 'zod';

// CSP（script-src 'self'）では eval が禁止。zod は既定で new Function を試し、失敗を握りつぶしても違反として報告される。
// スキーマを作る前に設定する必要があるため、main.tsx の最初の import にする（ES モジュールは import の順に評価される）
z.config({ jitless: true });
