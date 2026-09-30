# CLAUDE.md

日本語ローマ字入力のタイピング練習アプリ（個人学習用・PC 専用）。正しく計測でき、弱点を克服できることが目的。
**新しいセッションは、まず `docs/HANDOFF.md`（現状・決定・運用・次の候補）を読む。**
方針とロードマップは `docs/PLAN.md`、今後の作業は `task.md`、仕様は `docs/spec/`。

## 言語
コメント・コミットメッセージ・ドキュメント・ユーザーへの説明は**日本語**で書く（識別子は英語）。

## コマンド
```bash
npm run dev            # 開発サーバー
npm run check          # lint → 型 → テスト(カバレッジ閾値つき) → ビルド。CI と同じ。push 前に必ず通す
npm test               # ユニット/コンポーネントテスト（vitest）
npm run e2e            # 実ブラウザの E2E（Playwright）。ローカルでは CHROMIUM_PATH を指定することがある
npm run budget         # 配信量の予算（docs/budget.json）。check に含まれる
scripts/verify.sh      # check + E2E（push 前・main 反映前）
scripts/mutate.sh      # 変異テスト 1 件（KILLED / SURVIVED）
node scripts/shot.mjs  # 画面のスクリーンショット（場面は scripts/scenarios.mjs）
```
**進め方は `docs/WORKFLOW.md`**（スライスのサイクル・定義・実ブラウザ確認の作法・長時間作業）。プロジェクトのスキル `typing-dev`（`.claude/skills/`）に要点がある。
- ローカルの Chromium が Playwright の期待と違うとき: `CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`（CI は標準ブラウザ）。
- E2E は `npm run build` した `dist` を配信する。**ソースを変えたら E2E の前にビルドし直す**（`playwright.config.ts` の webServer が実行する）。

## 構成と依存の向き
```
src/engine    ローマ字入力の判定。React/DOM に依存しない。他の層に依存しない
  table/      Mozc 表(同梱)から許容表を生成。rules.ts に除外と推奨順
  testing/    テスト専用の IME シミュレータ（オラクル）
src/metrics   打鍵ログ → 指標・統計・弱点。純関数。engine に依存
src/session   練習1回分の進行(PracticeSession)、出題の選び方、デイリー(daily.ts)、ゴースト(ghost.ts)、再挑戦(retry.ts)。engine / metrics に依存
src/storage   zod スキーマ、版移行、JSON 入出力、IndexedDB(sessions / packs) / メモリ
src/content   出題パック(JSON: basic / english / symbols / phrases) と zod 検証、自作パックの取り込み(import.ts)
src/settings  練習の設定（パック・語数・弱点優先・運指ガイド・配列・目標の級位）。localStorage
src/fingering キー配列(US/JIS)と運指（どの指でどのキーか）。ガイド表示専用
src/input     KeyboardEvent の除外判定（repeat / IME 中 / 修飾キー併用）
src/screens   画面（Home / Play / Result / Stats）。src/screens/stats はグラフ部品
src/app       ルーティングと保存先の提供
src/themes    テーマ（配色・文言・音・3D・ボス・ステージ）の定義と検証。標準テーマは常に存在。コアは import しない
src/effects   演出の強さ（標準/控えめ/オフ）と、three.js の 3D シーン。描画だけ
src/sound     効果音（SoundPlayer）と BGM（BgmManager）。画面ごとの曲は useSceneBgm / useGameBgm
art/          3D モデルと語彙の元データを作るスクリプト（Blender は bpy）。README に手順
e2e/          Playwright
```
依存は `engine ← metrics ← session / storage ← screens`。**engine から上位層を import しない。**

## 守ること

### 入力ルール（最重要）
- 入力の許容範囲の**正は `docs/spec/input-rules.md`**。挙動を変えるときは、仕様書 → テスト → 実装の順に直し、`src/engine/version.ts` の版を上げる。
- **入力表を手書きしない。** `src/engine/table/mozc/romanji-hiragana.tsv`（Mozc・BSD-3-Clause、`NOTICE.txt` 付き）から生成する。この TSV は**編集しない**。
- 許容から外す行は `rules.ts` の `EXCLUDED_ROWS` に**理由付きで**足す。理由の無い除外はテストで落ちる。
- 「ん」「っ」は表ではなく `plan.ts` の規則（次の打鍵への制約）で扱う。判定とガイドは**同じ状態**から導く。別ロジックを作らない。
- 過去に誤っていた許容（`を`→`o`、`ぢ/づ`→`zi/zu`、母音キーでの長音）を戻さない。

### 計測とデータ
- 指標・統計は**打鍵ログから純関数で再計算**する。指標を保存しない。
- 複数セッションの遅延は**セッションごとに集計して合算**する（`aggregate` / `keyWeakness`）。打鍵を連結すると、セッションの境界で偽の連続2打鍵ができる。
- 保存形式（`src/storage/schema.ts`）を変えるときは `CURRENT_SCHEMA_VERSION` を上げ、`migrate.ts` に移行を足し、テストを書く。
- IndexedDB の構造（ストアの追加など）を変えるときは `indexedDbStore.ts` の `DB_VERSION` を上げ、`onupgradeneeded` で **oldVersion ごとに足りない部分だけ**作る（既存データを消さない）。旧版のDBから開くテストを書く（`storage.test.ts` の v1 → v2）。
- 出題データは JSON + zod。読み込み時に**全語が打てること・重複が無いこと**を検証する（`src/content/schema.ts`）。

### 出題パック
- 組み込みパックは読み込み時に検証される（全語が打てる・重複なし）。**読みが正しいか（誤字）は機械では検証できない**。追加したら、読みを声に出して確認する。
- デイリーの対象は `DAILY_PACKS` だけ。パックを足しても過去の日のお題が変わらないよう、`BUILTIN_PACKS` とは別に管理している。

### アクセシビリティ（詳細と限界は `docs/a11y.md`）
- 新しい画面は `PageHeading`（タイトル更新・見出しへのフォーカス）を使い、h1 を必ず持つ。
- キーボードのショートカットは、フォーカス中の操作要素（ボタン・リンク・入力欄）の動作を奪わない（ホームの Enter の判定を参照）。
- **色だけで意味を伝えない。** 文字・形・枠を併用する。`:focus-visible` の共通スタイルを消さない。
- 新しい画面・状態を足したら `e2e/a11y.spec.ts` に axe の検査を足す。実際のスクリーンリーダーでの確認は、まだ人が行っていない。

### 統計のグラフ
- 少ないデータの区分は、色だけでなく形（枠だけ）でも区別し、参考値と明記する（`MIN_SAMPLE`）。「最良」は、比べられる区分が2つ以上あるときだけ出す。
- 棒はゼロ基準。ゼロ基準で差が見えない指標（正確率など）は、逆の指標（ミス率）にする。

### 級位・運指ガイド
- 級位の段階は `src/metrics/rank.ts` に集約し、`docs/spec/ranks.md` の表と一致させる（テストが検査する）。値を変えるときは両方を直す。仮置きの値なので、根拠のない数値を「確定」と書かない。
- 級位の判定に数えるのは、正確率が基準以上の練習だけ。現在の級位は直近の中央値で決める（1回の好不調で動かさない）。
- 運指ガイドは表示専用。判定は `KeyboardEvent.key`（打った文字）で行い、配列の設定に依存させない。配列データを変えたら、`layout.test.ts` の「全文字がちょうど1通り」が通ることを確認する。

### デイリーとゴースト
- デイリーのお題は日付だけから決まる。**`Math.random` を使わない**（`seededRandom` を使う）。同じ日は、いつ・誰が開いても同じお題であること。
- ゴーストが有効なのは、**お題の並びが完全に一致**する記録だけ（`findBestRecord`）。比較は位置（お題の何個分）と到達時刻で行い、打鍵数では比べない（経路が違うと打鍵数が変わるため）。
- 「先行/遅れ」は色だけで示さない（符号と語を必ず付ける）。

### テーマ・演出・音
- 作品の名称・台詞・画像・音は `src/themes/` と `public/themes/<テーマ>/` に置く。コア（engine / metrics / session の計算）に入れない。詳細は `docs/adr/0001`（テーマ）と `0002`（入口・BGM・ステージ）。
- 演出は**描画だけ**で、打鍵の判定・計測に関わらない。強さ（標準/控えめ/オフ）と OS の「動きを減らす」に従い、基本の見た目を「最後の姿」にして動きを @keyframes で足す。点滅させない。飾りは `aria-hidden`、同じ内容は文字でも伝える。
- ブラウザは、ユーザー操作の前の音を拒む。BGM は入口のゲートの操作から流し、拒まれても例外にせず `unlock()` で再試行する。テーマを選んでも、標準テーマの配信量を増やさない（3D・BGM・語彙は選んだときだけ読み込む）。
- 3D の見た目の確認は、ヘッドレスではソフトウェア描画で遅い。演出中に画面が切り替わって撮れないことがある。`page.evaluate` でタイマーを全消去しない（Suspense の表示が止まる）。遷移だけ止める（`history.pushState` を無効化）。
- ステージの語彙は `GEN_STAGES` の生成ツールで作る（手で編集しない）。`hunterChapters.ts` は生成物。

### コアに固有名詞を置かない
原作・既存作品の名称、台詞、画像、音源をコアに入れない。世界観は「テーマパック」として分離する（`task.md` P2）。

### UI
- 色・フォントは `src/index.css` の `@theme` と `--viz-*` に集約する。直書きしない。
- グラフを作る・変えるときは、`dataviz` スキルの手順に従い、**色は検証スクリプトで確認**してから使う。ツールチップ・表ビュー・キーボード操作を付ける。
- 描画中に `Date.now()` などの非純粋な関数を呼ばない（lint で落ちる）。読み込み時に state へ持つ。
- ユーザー由来の文字列を `innerHTML` に入れない。
- 打鍵処理を演出で遅らせない。入力処理と描画を分ける。
- 練習画面のキーは `window` の `keydown` で受け、`isGameKey` で除外判定する。

## テストの書き方
- **空振りのテストを書かない。** 期待値を手計算し、実装を故意に壊して（変異）、テストが落ちることを確認する。`fc.pre` で捨てすぎていないかも見る。
- エンジンはカバレッジ閾値（文95/分岐90/関数95/行95）を CI で強制している。`src/engine` `src/metrics` `src/storage` `src/input` が対象。
- IME との突き合わせ（`property.test.ts`）は Mozc 表のみに基づく独立実装。エンジンの内部関数に依存させない。
- **ランダムテスト（fast-check）は実行ごとにシードが変わる。** 通ったからといって安心しない。まれな反例は `FC_RUNS=150000 npx vitest run src/engine/property.test.ts` で探す。反例が出たら、エンジンの不具合か、テストの前提の漏れ（仕様で除外した行を IME が使った等）かを切り分け、後者は `fc.pre` の条件を系統的に足して、反例を固定のテストとして残す。
- ランダムなお題を使う E2E では、「どのお題でも間違いになるキー」を選ぶ（例: `1`）。`q` は「く」（`qu`）で有効なため、間違い入力にならない。
- E2E は画面が表示されるまで待ってからキーを押す（読み込み前のキーは無視される）。
- 見た目を変えたら、実ブラウザで**スクリーンショットを撮って確認**する（jsdom では色・レイアウトの継承などの不具合が見えない）。

## Git
- **`main` に直接コミットしない**（最初の雛形を除く）。機能ごとにブランチを切る。`main` への反映は、**オーナーが「メインに反映して」と言ったときだけ**（CI 緑を確認して `--ff-only`）。
- PR は、頼まれたときだけ作る。
- コミットメッセージは日本語。`feat(engine): …` `fix: …` `test: …` `docs: …` の接頭辞を使う。
- push する前に `npm run check` を通す。CI は全ブランチの push で動く（check + e2e）。

## 公開
`main` への push で `.github/workflows/deploy.yml` が GitHub Pages に公開する。アセットは相対パス（`vite.config.ts` の `base: './'`）、画面遷移はハッシュ（`#/...`）。サブパス配下でも動く前提を崩さない（絶対パスの `/assets/...` や、ハッシュを使わない遷移を入れない）。

## 既知の落とし穴
- React StrictMode の開発時は effect が2回走る。`Play` のセッション生成は、キャンセルフラグで先の1回を捨てている。
- `KeyboardEvent` は IME 変換中に `isComposing` と `keyCode === 229` のどちらか片方しか立たないことがある。両方を見る。
- Mozc 表には同一行の重複がある（`fu`→「ふ」）。生成時に重複を除いている。
- `vitest` は型を検査しない。テストが通っても `npm run typecheck` が落ちることがある。
