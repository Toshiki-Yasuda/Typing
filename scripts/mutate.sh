#!/bin/bash
# 変異テスト 1 件: ファイルを故意に壊して、テストが落ちる（KILLED）ことを確かめ、必ず元に戻す。
# 使い方: scripts/mutate.sh <名前> <ファイル> <sed 式> <vitest のパス...>
#   例: scripts/mutate.sh "境界を含めない" src/session/combo.ts 's/combo >= /combo > /' src/session/combo.test.ts
# 結果: BASELINE-RED（元から赤）/ KILLED（落ちた＝テストは効いている）/ SURVIVED（通った＝テストが空振りか、等価な変異）/ NOT-APPLIED（式が合わない）
set -uo pipefail
cd "$(dirname "$0")/.."
name="$1"; file="$2"; expr="$3"; shift 3
backup="$(mktemp)"
cp "$file" "$backup"
trap 'cp "$backup" "$file"; rm -f "$backup"' EXIT

# 土台（変異なし）が緑でないと、変異が「落ちた」のか元から赤いのか区別できない
if ! npx vitest run "$@" >/dev/null 2>&1; then
  echo "BASELINE-RED $name（変異の前からテストが落ちています。先に直してください）"
  exit 3
fi

sed -i -E "$expr" "$file"
if cmp -s "$file" "$backup"; then
  echo "NOT-APPLIED  $name（sed 式が合っていません）"
  exit 2
fi
out="$(npx vitest run "$@" 2>&1)"
line="$(echo "$out" | grep -E "Tests " | tail -1 | sed 's/^ *//')"
if echo "$out" | grep -qE "Failed Tests|FAIL"; then
  echo "KILLED       $name — $line"
else
  echo "SURVIVED     $name — $line"
  exit 1
fi
