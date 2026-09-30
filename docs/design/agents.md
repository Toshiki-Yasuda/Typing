# 練習画面アップグレードの、複数エージェントでの進め方

計画の本体は [play-upgrade.md](play-upgrade.md)。ここは**分担と手順**（オーケストレーター＝人間側のセッションが統括）。

## 1. なぜ準備が要るか
複数のエージェントが同じファイル（`Play.tsx`・`index.css`・`settings.ts`）を触ると、マージで衝突し、手戻りが最大の損失になる。そこで:
1. **準備（Wave 0・完了済み）**: 共有ファイルの「継ぎ目」を先に作る。見た目は変えない。
2. **各エージェントは自分の所有ファイルだけ**を触る（下の表）。共有ファイルは触らない。
3. 各エージェントは **git worktree**（隔離した作業コピー）で作業し、**コミットまで**行う。**push・main 反映・共有文書（task.md / HANDOFF）の更新はしない**。
4. オーケストレーターが、コミットを 1 本ずつ取り込み（`git merge`）、そのたびに `scripts/verify.sh` を通す。

### Wave 0 で作った継ぎ目
| 継ぎ目 | 内容 |
|---|---|
| `src/screens/play/PlayFrame.tsx` | 画面の骨組み（スロット: hud / notices / stage / guide / queue / overlay）。**Play の JSX は、ここへ部品を渡すだけ** |
| `src/screens/play/HudBar.tsx` | 上部バー（進捗・時間・中断） |
| `src/screens/play/QueueRail.tsx` | 待ち行列（左のレール）。PlayFrame はまだ使っていない |
| `src/screens/play/Backdrop.tsx` | 背景の3層。PlayFrame の先頭に据え付け済み（いまは null） |
| `src/screens/play/types.ts` | `PressFx`（直前の打鍵の結果: seq / result / key / expected）。`TargetView` と `FingerGuide` に `press` として渡される |
| `SessionView.upcoming` | 次以降のお題（最大 `QUEUE_LENGTH`=4 件） |
| `src/styles/{stage,backdrop,hud,guide,fx}.css` | 機能ごとの CSS。`index.css` から import 済み（**index.css は誰も編集しない**） |
| 設定 `showQueue` / `liveStats` / `fingerColors` | 保存・既定（すべて true）・ホームの設定のチェックまで作成済み。**挙動は各担当が実装** |

### 作業コピー（worktree）の作り方 — 重要
エージェントに `isolation: worktree` を使うと、**作業ブランチではなく古い基点（main）から作られる**ことがある（継ぎ目が無い状態で始まり、担当が止まる）。そこで**オーケストレーターが作業コピーを作り**、エージェントには絶対パスで場所を渡す:
```bash
# 準備コミットを済ませてから（git log で継ぎ目のコミットを確認）
for x in a b c d e; do git worktree add -b wave1-$x .claude/worktrees/wave1-$x HEAD; done
```
- エージェントは `isolation` を付けずに起動し、プロンプトの先頭で「作業場所は `/home/user/Typing/.claude/worktrees/wave1-x`。本体と他のコピーには触れない。merge/rebase/push/reset をしない」と伝える。
- `.claude/worktrees/` は `.gitignore` 済み。取り込み後は `git worktree remove` とブランチ削除で片づける。
- 各コピーには `node_modules` が無い。エージェントが最初に `npm install --no-audit --no-fund` を行う。

## 2. 所有ファイル表（衝突しないように分ける）
| 担当 | 段階 | 触ってよいファイル | 触ってはいけない |
|---|---|---|---|
| **A** 骨組み | U1a | `play/PlayFrame.tsx`, `play/QueueRail.tsx`, `styles/stage.css`, それらのテスト（`play/*.test.tsx`） | `Play.tsx`, `TargetView.tsx`, `Backdrop.tsx`, `index.css` |
| **B** 主役の型 | U1b | `TargetView.tsx`, `targetView.test.tsx`, `styles/stage.css` の `.target-*` ブロック（A と同じファイルなので、**`/* B: */` と `/* A: */` の区画に分ける**） | `PlayFrame.tsx`, `Play.tsx` |
| **C** 背景 | U1c | `play/Backdrop.tsx`, `styles/backdrop.css`, `play/backdrop.test.tsx` | 他のすべて |
| **D** HUD | U2 | `play/HudBar.tsx`, `metrics/live.ts`（新規）, `metrics/live.test.ts`, `styles/hud.css`, `play/hud.test.tsx` | `Play.tsx`（HudBar に渡す props が足りなければ、**報告して止める**） |
| **E** 運指ガイド | U4 | `FingerGuide.tsx`, `fingering/*`（色・ラベルの追加のみ。`layout.test.ts` を壊さない）, `styles/guide.css`, `fingerGuide.test.tsx` | `Play.tsx` |

`Play.tsx` の変更が必要になったら、**エージェントは変更せず、必要な props とその理由を報告**する。オーケストレーターが 1 か所でまとめて入れる（衝突の元を 1 人に集める）。

### 依存の順序（Wave）
- **Wave 1（並列）**: A・B・C・D・E。互いに所有ファイルが重ならない。
- **Wave 2（Wave 1 の取り込み後に並列）**: **F**（U3 打鍵の手応え: `TargetView.tsx` のキャレット・ミス・語の切り替え、`styles/fx.css`）と **G**（U5 空気と達成: `play/fx/*` 新規、`sound/synth.ts` 新規、`styles/fx.css` の別区画）。`press` を使う。
- **Wave 3**: U6（仕上げと計測）と、レビュー専任のエージェント（デザイン・a11y・性能）。

## 3. 全エージェント共通のルール
1. まず読む: `CLAUDE.md`、`docs/WORKFLOW.md`、`docs/design/play-upgrade.md` の**自分の段階**と「守るべき制約」。
2. **判定・計測に触れない**。演出は描画だけ。打鍵から描画までを遅らせない。色だけで意味を伝えない。点滅させない。「動きを減らす」と演出の強さ（標準/控えめ/オフ）に従い、**基本の見た目＝最後の姿、動きは `@keyframes` で足す**。
3. **既存のアクセシブルな名前を変えない**（`お題` / `ローマ字ガイド` / `運指ガイド` / `進捗` / `タイマー`）。装飾は `aria-hidden`。
4. 色・フォントは `src/index.css` のトークン（`var(--color-*)`, `--viz-*`）から作る。**色を直書きしない**。新しいトークンが要るときは、自分の CSS ファイルのローカル変数にする。
5. 進め方は `docs/WORKFLOW.md` のサイクル: 仕様（受け入れ条件）→ 純関数/部品 → **変異テスト**（`scripts/mutate.sh`、期待値を手計算）→ 画面 → **スクリーンショット**（`node scripts/shot.mjs playBase`、Before/After を見る）→ E2E は既存が無変更で通ること → `npm run check`。
6. 新しいテストは**空振りさせない**（変異で確認）。jsdom の `timeStamp` は epoch ミリ秒なので、時間の判定は `performance.now()` を使う。E2E は待ち方に注意（`docs/WORKFLOW.md`）。
7. 共有文書（`task.md` / `docs/HANDOFF.md` / `CLAUDE.md`）は**編集しない**。報告に「文書に書いてほしいこと」を書く。
8. **コミットまで**（日本語、`feat(play): …`、末尾に共通のトレーラ）。**push しない・PR を作らない・main に触れない**。
9. 完了報告に必ず書く: ①コミット ID ②変更ファイル ③Before/After の撮影パス ④テスト結果（`npm run check` の結果） ⑤変異の結果（KILLED/SURVIVED） ⑥`Play.tsx` に入れてほしい変更（あれば） ⑦気づいた問題・オーナーに聞きたいこと。

## 4. 取り込み手順（オーケストレーター）
1. 各エージェントのコミットを、Wave 内で影響の大きい順（A → B → C → D → E）に `git merge`。衝突したら、所有表に反して触られたファイルを疑う。
2. 1 本ごとに `npm run check`、Wave の終わりに `scripts/verify.sh`（E2E 込み）。
3. 撮影（1920 / 1440 / 1280 / 1024 / 390）を見て、デザインの一貫性を確認。ずれは次の Wave か、調整コミットで直す。
4. `Play.tsx` への変更を 1 コミットでまとめる。文書（task.md・HANDOFF）を更新。push。`main` への反映は依頼があったとき。

## 5. エージェントへの指示（要点）

### A（U1a）骨組み: 3 ゾーン
`PlayFrame` を、幅 1200px 以上で 3 ゾーン（左: `queue` / 中央: `stage` + `notices` / 右: `guide`）にする。内容の幅は画面の約 90%（最大 1680px）。1024〜1199px は左レールを畳む。それ未満は現行の縦 1 列。`QueueRail` は `upcoming` を「遠いほど小さく薄く」で並べ、`settings.showQueue` が false なら出さない（PlayFrame が `useSettings` を読む）。**受け入れ**: 1920/1440/1280/1024/390 の撮影で左右の空白が使われている（内容幅 ≥ 画面の 85%）／横スクロール無し（`node scripts/overflow.mjs 1024 /play`）／既存 E2E 無変更で通る／`QueueRail` のテスト（表示・順序・オフ）と変異。

### B（U1b）主役の型
`TargetView` の文字を大きく（表示語 `clamp(2.75rem,5.5vw,5rem)`、ローマ字 `clamp(2.25rem,4.5vw,3.75rem)`、読みは中間）。`sizeClasses` を拡張しテスト更新（境界の変異）。打ち終えたローマ字は灰色に暗くせず、明るい前景で淡いアクセント色に。次の1文字は青＋下線に太字と淡い塗り。お題のカードは舞台の面（額縁・二重の縁・内側の淡い光。CSS は `styles/stage.css` の B の区画）。**アクセシブルな構造（region 名 `お題`、`ローマ字ガイド` のラベル、`次:` の先読み、`data-weak`）は変えない**。**受け入れ**: 長い文（60字）でも収まる／`targetView.test` 更新／コントラスト（axe）／撮影。

### C（U1c）背景の3層
`Backdrop` を実装: ①遠景＝ゆっくり流れる淡いグリッド/放射線（`background-position` を 60 秒周期、`prefers-reduced-motion` と演出「オフ/控えめ」では静止）、②中景＝アクセント色（`var(--color-accent)`）の光とビネット、③前景＝舞台の足元の光のレールの土台（伸びる動きは U5 が担当なので、静的な線だけ）。`--stage-*` トークンをテーマから差し替え可能にする（`--stage-glow`, `--stage-grid` など。既定はアクセント色から `color-mix`）。演出の強さは `useSettings` の `effects` と `prefersReducedMotion()` を使う。**受け入れ**: 3 種の演出で撮影／`aria-hidden`・`pointer-events: none`／テーマ（HUNTER）で色が追従／CPU（`getAnimations` の数が少ない）／テスト。

### D（U2）ライブ HUD
純関数 `liveMetrics(keystrokes, nowMs)`（`metrics/live.ts`）: 速さ（打鍵/分、既存の実効速度の定義に合わせる）・正確率・ミス数・経過秒。既存の `computeMetrics` を再利用し、二重の定義を作らない。`HudBar` を、語ごとの刻みの進捗（完了/現在/未来を形と文字で）、数字の表示（`settings.liveStats` が false なら数字を隠す）、「中断（Esc）」に。**`Play.tsx` から渡す props が足りなければ報告して止める**（暫定は `HudBar` の props に任意項目を足して、渡されなければ数字を出さない形にする）。**受け入れ**: `liveMetrics` の表テスト＋変異／`hud.test.tsx`／読み上げ（`aria-live`）にしない／撮影。

### E（U4）運指ガイド
`FingerGuide` に、指ごとの薄い色分け（`settings.fingerColors` が true のとき。色は `dataviz` の検証で、暗い面でも隣の指が区別できること。**指のラベル（小指・薬指…の頭文字）をキーに併記**）。ホームポジションの手の線画（SVG）と、遠いキーへの移動方向の矢印。キーの大きさを CSS 変数化（最大 44px）。図の下の注記は削除し、`aria-describedby` の説明に移す。**`press`（直前の打鍵）を使い、押したキーの輪郭の光（正）と、押した実キーの×印＋正しいキーの枠の脈打ち（誤）を実装**（U3 ではなくこちらが担当。演出の強さに従う）。**受け入れ**: `layout.test.ts` が通る／色の検証結果を報告／ラベルがあり色だけに頼らない／撮影。

## 6. 進捗の見方
- 各エージェントの完了報告（上の 9 項目）を、この文書の末尾の「Wave 記録」に日付つきで残す。


## Wave 記録
### Wave 1（2026-09-30）— A・B・C・D・E を取り込み、統合済み
- 取り込み: E → C → D → B → A の順（所有ファイルが重ならないものから）。`stage.css` の A・B 区画だけ隣接して衝突したが、区画コメントのおかげで両方を残すだけで解消できた。
- 統合で私が入れた変更: `Play.tsx` に `liveMetrics`（1 秒ごとの経過時間 state）と HudBar の `stats` / `showStats` / `onAbort`。
- 統合で見つかった不具合（エージェントの単体テストでは出ず、E2E の axe が見つけた）: ①HUD の `<dl>` の `<div>` に `dt`/`dd` 以外（単位の span）があった ②待ち行列の遠い語の不透明度が低すぎてコントラスト不足（2.69:1）。①は単位を `dd` の中へ、②は薄さの下限を上げて修正。
- 既存テストの更新: HUD の数字欄に「ミス」ラベルができたため、IME 中に「ミス表示が出ない」ことを確かめるテストを、お題カードの表示に絞った（対照の確認つき）。
- **教訓**: ①エージェントは並列の負荷で `npm run check` を通しきれなかった。**取り込み後に、負荷のない状態で check と verify.sh を回すのはオーケストレーターの仕事**。②E2E（axe）は統合後にしか回せないので、Wave の終わりに必ず回す。③`isolation: worktree` は古い基点になることがある（上の「作業コピーの作り方」）。
- 未対応（次の調整コミット候補）: 光のレールの位置（`--stage-rail-y`）が 3 ゾーンのお題の位置と合っていない／1024px で指の案内が画面の下に隠れる／1200〜1439px の `zoom: .85` は E のキー大きさの変数化で外せる／進捗の刻みが 50 語以上で細すぎる／HUD の数字が小さい／色分けオフで頭文字ラベルも消える（要確認）。
