/**
 * 練習・ステージ・ボス戦が終わった後の動線（結果画面の「次に何をするか」）。
 * 主ボタン（Enter）・副ボタン・Esc の行き先を、状況から決める純関数。画面のことは知らない。
 * 方針（docs/spec/flow.md）: ステージ・ボスの結果は、ステージの文脈から出さない。先へ進むのが主役。
 */
export interface FlowAction {
  readonly label: string;
  readonly to: string;
}

export interface AfterFlow {
  readonly primary: FlowAction;
  readonly secondary: readonly FlowAction[];
  /** Esc の行き先 */
  readonly escTo: string;
  /** ステージ・ボスの文脈か（結果の上に動線を出す／下の「新しいお題」などは出さない） */
  readonly inGame: boolean;
}

export interface FlowInput {
  readonly recordId: string;
  /** ステージの記録のとき */
  readonly stage?: {
    readonly id: string;
    readonly cleared: boolean;
    /** 同じ章の次のステージ（最後なら null） */
    readonly next: { readonly id: string; readonly name: string } | null;
    /** 章のボスの id（無ければ null） */
    readonly bossId: string | null;
  };
  /** ボス戦の記録のとき */
  readonly boss?: {
    readonly id: string;
    readonly name: string;
    /** 勝ったか（履歴から開き直したなど、分からないとき null） */
    readonly won: boolean | null;
    /** 勝ったあとの行き先: 次の章の最初のステージ（最後の章なら null） */
    readonly nextStage: { readonly id: string; readonly name: string } | null;
  };
}

export const STAGES_PATH = '/stages';
const toStages: FlowAction = { label: 'ステージ選択へ', to: STAGES_PATH };

export function afterFlow(input: FlowInput): AfterFlow {
  const { stage, boss } = input;
  if (stage) {
    const again: FlowAction = { label: 'もう一度このステージ', to: `/stage/${stage.id}` };
    if (!stage.cleared) return { primary: again, secondary: [toStages], escTo: STAGES_PATH, inGame: true };
    if (stage.next) {
      return {
        primary: { label: `次のステージ: ${stage.next.name}`, to: `/stage/${stage.next.id}` },
        secondary: [again, toStages],
        escTo: STAGES_PATH,
        inGame: true,
      };
    }
    if (stage.bossId) {
      return {
        primary: { label: 'この章のボスに挑戦', to: `/boss/${stage.bossId}` },
        secondary: [again, toStages],
        escTo: STAGES_PATH,
        inGame: true,
      };
    }
    return { primary: toStages, secondary: [again], escTo: STAGES_PATH, inGame: true };
  }
  if (boss) {
    const again: FlowAction = { label: `${boss.name}にもう一度挑戦`, to: `/boss/${boss.id}` };
    if (boss.won === false) return { primary: again, secondary: [toStages], escTo: STAGES_PATH, inGame: true };
    if (boss.won === true && boss.nextStage) {
      return {
        primary: { label: `次の章へ: ${boss.nextStage.name}`, to: `/stage/${boss.nextStage.id}` },
        secondary: [again, toStages],
        escTo: STAGES_PATH,
        inGame: true,
      };
    }
    return { primary: toStages, secondary: [again], escTo: STAGES_PATH, inGame: true };
  }
  return {
    primary: { label: '同じお題でもう一度', to: `/play?retry=${input.recordId}` },
    secondary: [
      { label: '新しいお題で練習', to: '/play' },
      { label: 'ホーム', to: '/' },
    ],
    escTo: '/',
    inGame: false,
  };
}
