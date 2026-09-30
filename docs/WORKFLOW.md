# 開発の進め方（長時間・継続作業の手順）

会話の履歴が無くても、同じ品質で作業を続けられるようにするための手順書。
関連: [HANDOFF.md](HANDOFF.md)（現状）／[PLAN.md](PLAN.md)（計画）／[../task.md](../task.md)（バックログ）／[../CLAUDE.md](../CLAUDE.md)（守ること）。

## 1. セッションの始め方（5 分）
1. `docs/HANDOFF.md` → `docs/PLAN.md` の「次のプラン」→ `task.md` の「現在のバックログ」を読む。
2. `git log --oneline -15` と `git status` で、直前の作業を確認する。
3. 依存は SessionStart フック（`.claude/hooks/session-start.sh`）が入れる。入っていなければ `npm install`。
4. バックログの先頭から、今回のスライスを 3〜6 個選んで `TaskCreate` に登録する（完了ごとに更新する）。

## 2. スライスのサイクル（1 つの機能を、この順で最後まで）
小さく切って（目安: 半日以内）、毎回ここまで終えてから次へ進む。

| 手順 | 内容 | 道具 |
|---|---|---|
| ① 仕様 | 挙動を文章と表で固める（`docs/spec/`・ADR）。数値は「仮」と明記 | — |
| ② 核 | 純関数（DOM・時計・乱数に依存しない）＋表テスト | `npx vitest run <path>` |
| ③ 変異 | 実装を故意に壊し、テストが落ちるか確かめる。**生き残ったら、テストを直すか、等価な変異なら冗長なコードを消す** | `scripts/mutate.sh` |
| ④ 画面 | 部品＋コンポーネントテスト（jsdom）。演出の強さ 3 種・標準テーマで出ないこと | — |
| ⑤ E2E | 実ブラウザの流れ＋axe（`e2e/*.spec.ts`）。axe の前にアニメーションの完了を待つ | `npx playwright test <file>` |
| ⑥ 目視 | 見た目を変えたら必ず撮って、画像を読んで確認する | `scripts/shot.mjs` |
| ⑦ 一括確認 | lint→型→テスト→ビルド→予算→E2E | `scripts/verify.sh` |
| ⑧ 文書 | ADR・spec・task.md・HANDOFF を、コードと同じコミットで更新 | — |
| ⑨ 記録 | 日本語のコミットメッセージ（接頭辞＋箇条書き＋Co-Authored-By）→ push | `git push -u origin <branch>` |
| ⑩ CI | push 後の CI が緑か確認する。赤なら最優先で直す | `mcp__github__actions_list` |

**main への反映はオーナーが「メインに反映して」と言ったときだけ。** CI の check と e2e の両方が緑なのを確認し、`git push origin <検証済みsha>:refs/heads/main`（fast-forward のみ）。プランなどの文書だけのコミットは、次の反映のときに入れてよい。

## 3. 定義（Done）のチェックリスト
- [ ] 仕様どおりの挙動をテストが固定している。変異で落ちる（生き残りは説明できる）。
- [ ] 打鍵の判定・計測・保存を変えていない（変えるなら仕様書 → テスト → 実装、版を上げる）。
- [ ] 演出は描画だけ。標準／控えめ／オフ、OS の「動きを減らす」に従う。点滅しない。飾りは `aria-hidden`、意味は文字でも出す。
- [ ] 新しい画面は h1（`PageHeading`）と axe の検査を持つ。キーボードだけで操作できる。
- [ ] 標準テーマの配信量を増やしていない（`npm run budget`）。
- [ ] 見た目を撮って確認した。
- [ ] `scripts/verify.sh` が通り、push 後の CI が緑。

## 4. 実ブラウザ確認の作法（この環境で学んだこと）
- Chromium は `/opt/pw-browsers/chromium`（`CHROMIUM_PATH`）。`playwright install` は不要。
- ヘッドレスは**ソフトウェア描画**で、3D の立ち上げに数秒かかる。演出が終わって画面が切り替わり、撮れないことがある。
  - **`page.evaluate` でタイマーを全消去しない**（React の Suspense の表示が止まる）。遷移だけ止める: `history.pushState = () => {}`（`blockNavigation`）。
  - 3D は先読みが済むまで待つ。動く演出の途中を撮るのは難しいので、「控えめ」（静止した 1 コマ）で構図を確認する。
- 早すぎるキー入力は取りこぼされる（フォーカス・リスナーの準備前）。**ゲートのボタンにフォーカスが乗ってから**押す。
- E2E の axe は、有限のアニメーションが終わってから（`settle`）。半透明の途中で測ると色の誤検出が出る。
- `pkill -f` は自分のシェルを殺す。プロセスは PID で止める（`startPreview` の `stop()`）。
- jsdom では `<audio>` が未実装（`src/test-setup.ts` で無害化）。BGM の再生は `AudioLike` の差し替えで検証し、実再生は E2E で `HTMLMediaElement.prototype.play` を記録して確かめる。
- 描画中に ref を読まない（lint）。状態は state に持つ。

## 5. テストの落とし穴
- モックは、呼ばれる関数をすべて持つこと（`getBgm` のモックに `setScale` が無くて落ちた）。
- `zod` v4 の `z.record(enum, …)` は全キー必須。一部だけなら `z.partialRecord`。
- 語の途中で止めて次の語に進むと、E2E で誤入力になる。1 語ずつ最後まで打つ。
- ランダムなお題の E2E は、どのお題でも間違いになるキー（`1`）を使う。
- 負荷（2 ワーカー）で稀に落ちるのは、待ち方の不足が多い。**単独で通るからと放置せず**、待つ条件（表示・フォーカス）を足して `--repeat-each=3` で確かめる。

## 6. 長時間の作業の進め方
- **こまめに記録**: スライスごとにコミット・push。目安は 1〜2 時間ごとに、HANDOFF と task.md を最新にする（途中で切れても、誰でも再開できる）。
- **止まらない**: オーナーの返事待ちで止まらない。決めるべき分岐は推奨を決めて進め、報告に「決めたこと」と「変えやすい場所」を書く。本当に取り返しのつかない選択（素材の削除、外部への公開など）だけ確認する。
- **詰まったら**: 原因を切り分けて記録し（task.md）、別のスライスに移る。同じ手を繰り返さない。
- **報告**: 区切りごとに、できたこと・検証・未確認・次を短く。数値と事実で書く。
- 大きな調査（原作の設定など）は、確認できた事実と記憶を分けて文書に残す。

## 7. 素材の作り方
- **3D モデル**: `scripts/setup-blender.sh`（bpy と ffmpeg を `.venv-art` に入れる。約 400MB）→ `art/<テーマ>/build_models.py`。造形はオリジナル。glTF は 1 ファイル 1MB 未満。
- **音声**: ffmpeg で 128kbps に再エンコード（BGM 1 曲 6MB 未満）。効果音は短く。
- **語彙**: `art/hunter/extract_ver1_words.py` → `GEN_STAGES=… npx vitest run src/content/genStages.test.ts`（生成物は手で編集しない）。
- 配信量は `docs/budget.json`。増やすときは理由をコミットに書く。

## 8. 道具の一覧
| コマンド | 用途 |
|---|---|
| `npm run check` | lint → 型 → テスト（カバレッジ）→ ビルド → 予算（CI の check と同じ） |
| `scripts/verify.sh [E2E の引数]` | check ＋ E2E（push 前・反映前） |
| `scripts/mutate.sh <名前> <ファイル> <sed式> <テスト...>` | 変異 1 件。KILLED / SURVIVED / NOT-APPLIED を出し、必ず元に戻す |
| `node scripts/shot.mjs <場面...>`（要 `npm run build`） | 画面のスクリーンショット。`--list` で場面の一覧 |
| `npm run budget` | 配信量の予算（`docs/budget.json`） |
| `scripts/setup-blender.sh` | Blender（bpy）・ffmpeg の準備 |
| `scripts/lib/browser.mjs` | 調査スクリプト用の部品（プレビュー起動・テーマ解除・打鍵・遷移止め・アニメ待ち） |
