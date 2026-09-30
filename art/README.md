# art/ — 3D モデルの元データ

テーマの 3D 小道具は、Blender のスクリプトで**毎回同じものを生成**する（手作業の調整は無い）。
生成した glTF（`.glb`）は `public/themes/<テーマ>/models/` に置いて配信する。

## 作り直す
```bash
python3 -m venv .venv && .venv/bin/pip install bpy   # Blender をモジュールとして入れる（約 370MB）
.venv/bin/python art/hunter/build_models.py public/themes/hunter/models            # 書き出し
.venv/bin/python art/hunter/build_models.py /tmp/preview --preview                 # 確認用の画像も出す
```
- モデルは**オリジナル**（ライセンス風のカード・トランプ）。キャラクターの造形は含めない。
- 上方向の軸が Blender（Z）と glTF（Y）で違うため、面は床向きで出てくる。`src/effects/heroScene.ts` の `upright` で正面に向ける。
- 増やすときは 1 ファイル 1MB 未満（`themes.test.ts` が検査する）。
