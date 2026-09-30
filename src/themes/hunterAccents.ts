/**
 * HUNTER テーマの、章ごとのアクセント色（章の id → #RRGGBB）。章の一覧 hunterChapters.ts は生成物なので、色だけ別に持つ。
 * 色は、背景 #13131f / #1e1e33 の上で 4.5:1 以上（themes.test.ts が検査する）。互いに見分けられる別々の色相にした。
 * 章の印象は仮のもの（実機で見て調整する）: 1=試験の緑 / 2=闘技場の橙 / 3=旅団の紫 / 4=夜の街の青 / 5=島の黄緑 / 6=蟻の朱 / 7=会長選挙の銀
 */
export const HUNTER_CHAPTER_ACCENTS: Readonly<Record<string, string>> = {
  c1: '#7bd88f',
  c2: '#f2a65a',
  c3: '#c792ea',
  c4: '#7aa7ff',
  c5: '#b5e853',
  c6: '#ff8f7a',
  c7: '#e8e4d0',
};
