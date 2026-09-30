#!/bin/bash
# Claude Code on the web: セッション開始時に、テスト・lint・E2E が動く状態にする。
# 同期実行（依存が入るまでセッションを始めない）。何度実行しても安全（冪等）。
set -euo pipefail

# ローカルの環境では何もしない（Web のコンテナ用）
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# 依存: コンテナの状態がキャッシュされるので、ci でなく install（差分だけ入る）
npm install --no-audit --no-fund --loglevel=error

# E2E: Playwright の Chromium はコンテナに入っている。ブラウザのダウンロードはしない
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  {
    echo 'export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1'
    if [ -x /opt/pw-browsers/chromium ]; then
      echo 'export CHROMIUM_PATH=/opt/pw-browsers/chromium'
    fi
  } >> "$CLAUDE_ENV_FILE"
fi
