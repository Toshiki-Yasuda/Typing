import type { AxisId } from '@/metrics/axes';

/** 軸の名前・見るもの・修行の提案（仕様: docs/spec/axes.md）。作品の言葉はここに入れない（テーマの diagnosis に置く） */
export const AXIS_INFO: Readonly<
  Record<AxisId, { label: string; measures: string; advice: string; to: string; toLabel: string }>
> = {
  speed: {
    label: '速さ',
    measures: '実効速度（正確率 95% 以上の練習の、直近 5 回の中央値）',
    advice: '正確さを保ったまま、少しずつ速く。ステージで語を打ち切る練習を重ねましょう。',
    to: '/stages',
    toLabel: 'ステージ選択へ',
  },
  adapt: {
    label: '適応',
    measures: '内容の種類（かな・英字・記号・短文）が替わっても、速さを保てるか',
    advice: 'まだ打っていない種類の練習をしてみましょう。設定の「出題」で英字・記号・短文を選べます。',
    to: '/settings',
    toLabel: '設定へ',
  },
  shape: {
    label: '形',
    measures: '数字・記号のキーの正確率',
    advice: '設定の「出題」を「数字と記号」にして練習しましょう。',
    to: '/settings',
    toLabel: '設定へ',
  },
  steady: {
    label: '安定',
    measures: '打鍵のリズムの一貫性',
    advice: '速さより一定のリズムを意識して、短文（ことわざ・文）を打ってみましょう。',
    to: '/settings',
    toLabel: '設定へ',
  },
  control: {
    label: '制御',
    measures: '全打鍵の正確率',
    advice: 'ミスを減らすことを最優先に。速度は気にせず、丁寧に打ちましょう。',
    to: '/play',
    toLabel: '練習へ',
  },
  reach: {
    label: '到達',
    measures: '小指のキーの遅れの少なさ',
    advice: '小指のキー（A・Q・Z・P・; など）を含む語を意識して練習しましょう。弱点を優先する設定が助けになります。',
    to: '/play',
    toLabel: '練習へ',
  },
};
