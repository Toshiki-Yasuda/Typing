#!/bin/bash
# 変異テスト 1 件: ファイルを故意に壊して、テストが落ちる（KILLED）ことを確かめ、必ず元に戻す。
# 使い方: scripts/mutate.sh <名前> <ファイル> <sed 式> <vitest のパス...>
#   例: scripts/mutate.sh "境界を含めない" src/session/combo.ts 's/combo >= /combo > /' src/session/combo.test.ts
# 結果: KILLED（落ちた＝テストは効いている）/ SURVIVED（通った＝テストが空振りか、等価な変異）/ NOT-APPLIED（式が合わない）
set -uo pipefail
cd "$(dirname "$0")/.."
name="$1"; file="$2"; expr="$3"; shift 3
backup="$(mktemp)"
cp "$file" "$backup"
trap 'cp "$backup" "$file"; rm -f "$backup"' EXIT

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
