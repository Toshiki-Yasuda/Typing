#!/bin/bash
# push 前・main 反映前の一括確認: npm run check（lint→型→テスト→ビルド→予算）→ E2E。
# 使い方: scripts/verify.sh [playwright の引数...]   例: scripts/verify.sh e2e/entrance.spec.ts
set -euo pipefail
cd "$(dirname "$0")/.."

npm run check

if [ -z "${CHROMIUM_PATH:-}" ] && [ -x /opt/pw-browsers/chromium ]; then
  export CHROMIUM_PATH=/opt/pw-browsers/chromium
fi
npx playwright test "$@"
echo "✔ verify: check と E2E が通りました"
