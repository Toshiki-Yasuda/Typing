#!/bin/bash
# 3D モデル・音声の再生成に使う道具（Blender の Python モジュール bpy と ffmpeg）を .venv-art に入れる。
# 約 400MB。3D や音声を作り直すときだけ実行する（普段のテスト・ビルドには不要）。
set -euo pipefail
cd "$(dirname "$0")/.."
python3 -m venv .venv-art
.venv-art/bin/pip install -q bpy imageio-ffmpeg
echo "✔ 準備できました。"
echo "  モデル: .venv-art/bin/python art/hunter/build_models.py public/themes/hunter/models"
echo "  ffmpeg: $(.venv-art/bin/python -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')"
