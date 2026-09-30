// 生成物: src/content/genStages.test.ts（GEN_STAGES）。手で編集しない。
// Ver1 の 7 章 × 5 ステージ。各章の 6 番目（総合チャレンジ）はボスの出題（themes/hunter/stages/c{章}s6.json）。
import type { Chapter } from './theme';

export const HUNTER_CHAPTERS: Chapter[] = [
  {
    id: 'c1',
    number: 1,
    title: 'ハンター試験編',
    subtitle: 'HUNTER EXAM',
    boss: 'chapter1',
    stages: [
      { id: 'c1s1', name: '母音の基礎', description: 'あいうえお', pack: 'themes/hunter/stages/c1s1.json' },
      { id: 'c1s2', name: 'ホームポジション', description: '基本の指配置', pack: 'themes/hunter/stages/c1s2.json' },
      { id: 'c1s3', name: '短い名前', description: 'ゴン、ジン など', pack: 'themes/hunter/stages/c1s3.json' },
      { id: 'c1s4', name: '主要キャラ', description: 'キルア、クラピカ など', pack: 'themes/hunter/stages/c1s4.json' },
      { id: 'c1s5', name: '試験用語', description: 'ハンター試験の言葉', pack: 'themes/hunter/stages/c1s5.json' },
    ],
  },
  {
    id: 'c2',
    number: 2,
    title: '天空闘技場編',
    subtitle: 'HEAVENS ARENA',
    boss: 'chapter2',
    stages: [
      { id: 'c2s1', name: '念の基礎', description: '念能力の用語', pack: 'themes/hunter/stages/c2s1.json' },
      { id: 'c2s2', name: '四大行', description: '纏・絶・練・発', pack: 'themes/hunter/stages/c2s2.json' },
      { id: 'c2s3', name: '系統', description: '六つの系統', pack: 'themes/hunter/stages/c2s3.json' },
      { id: 'c2s4', name: '闘技場用語', description: 'フロアマスターなど', pack: 'themes/hunter/stages/c2s4.json' },
      { id: 'c2s5', name: '応用技', description: '堅・凝・周・流など', pack: 'themes/hunter/stages/c2s5.json' },
    ],
  },
  {
    id: 'c3',
    number: 3,
    title: '幻影旅団編',
    subtitle: 'PHANTOM TROUPE',
    boss: 'chapter3',
    stages: [
      { id: 'c3s1', name: '旅団メンバー', description: 'クロロ、ノブナガなど', pack: 'themes/hunter/stages/c3s1.json' },
      { id: 'c3s2', name: '旅団用語', description: '蜘蛛の言葉', pack: 'themes/hunter/stages/c3s2.json' },
      { id: 'c3s3', name: '念能力①', description: '旅団の能力', pack: 'themes/hunter/stages/c3s3.json' },
      { id: 'c3s4', name: '念能力②', description: '旅団の能力（続）', pack: 'themes/hunter/stages/c3s4.json' },
      { id: 'c3s5', name: '名セリフ', description: '印象的なセリフ', pack: 'themes/hunter/stages/c3s5.json' },
    ],
  },
  {
    id: 'c4',
    number: 4,
    title: 'ヨークシン編',
    subtitle: 'YORKNEW CITY',
    boss: 'chapter4',
    stages: [
      { id: 'c4s1', name: '登場人物', description: 'ヨークシンのキャラ', pack: 'themes/hunter/stages/c4s1.json' },
      { id: 'c4s2', name: 'オークション', description: '地下競売の用語', pack: 'themes/hunter/stages/c4s2.json' },
      { id: 'c4s3', name: 'マフィア', description: '十老頭など', pack: 'themes/hunter/stages/c4s3.json' },
      { id: 'c4s4', name: '念能力', description: 'クラピカの能力など', pack: 'themes/hunter/stages/c4s4.json' },
      { id: 'c4s5', name: '名場面', description: '印象的な場面', pack: 'themes/hunter/stages/c4s5.json' },
    ],
  },
  {
    id: 'c5',
    number: 5,
    title: 'G・I編',
    subtitle: 'GREED ISLAND',
    boss: 'chapter5',
    stages: [
      { id: 'c5s1', name: 'GIキャラ', description: 'ビスケ、レイザーなど', pack: 'themes/hunter/stages/c5s1.json' },
      { id: 'c5s2', name: 'カード', description: 'スペルカード', pack: 'themes/hunter/stages/c5s2.json' },
      { id: 'c5s3', name: 'ゲーム用語', description: 'GIの用語', pack: 'themes/hunter/stages/c5s3.json' },
      { id: 'c5s4', name: '念能力', description: 'GIの能力', pack: 'themes/hunter/stages/c5s4.json' },
      { id: 'c5s5', name: '修行', description: 'ゴンの成長', pack: 'themes/hunter/stages/c5s5.json' },
    ],
  },
  {
    id: 'c6',
    number: 6,
    title: 'キメラアント編',
    subtitle: 'CHIMERA ANT',
    boss: 'chapter6',
    stages: [
      { id: 'c6s1', name: 'キメラアント', description: 'メルエム、護衛軍など', pack: 'themes/hunter/stages/c6s1.json' },
      { id: 'c6s2', name: 'キメラアント用語', description: '女王、王など', pack: 'themes/hunter/stages/c6s2.json' },
      { id: 'c6s3', name: '討伐隊の能力', description: '百式観音など', pack: 'themes/hunter/stages/c6s3.json' },
      { id: 'c6s4', name: '宮殿攻略', description: '作戦の用語', pack: 'themes/hunter/stages/c6s4.json' },
      { id: 'c6s5', name: 'ゴンの成長', description: '約束と怒り', pack: 'themes/hunter/stages/c6s5.json' },
    ],
  },
  {
    id: 'c7',
    number: 7,
    title: '選挙・暗黒大陸編',
    subtitle: 'ELECTION & DARK CONTINENT',
    boss: 'chapter7',
    stages: [
      { id: 'c7s1', name: '選挙編キャラ', description: '十二支ん', pack: 'themes/hunter/stages/c7s1.json' },
      { id: 'c7s2', name: 'アルカ・ナニカ編', description: 'キルアの妹', pack: 'themes/hunter/stages/c7s2.json' },
      { id: 'c7s3', name: '暗黒大陸の脅威', description: '五大厄災', pack: 'themes/hunter/stages/c7s3.json' },
      { id: 'c7s4', name: '王位継承戦', description: 'カキン帝国', pack: 'themes/hunter/stages/c7s4.json' },
      { id: 'c7s5', name: '旅団追加メンバー', description: '新メンバー', pack: 'themes/hunter/stages/c7s5.json' },
    ],
  },
];
