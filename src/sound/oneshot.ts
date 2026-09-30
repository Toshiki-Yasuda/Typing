/**
 * 短い効果音を 1 回鳴らす（オープニングの爆発音・決定音など）。
 * 失敗しても何も起きない（ユーザー操作の前など、ブラウザが拒むことがある）。
 */
export function playOnce(url: string | undefined, volume: number): void {
  if (!url || volume <= 0 || typeof Audio === 'undefined') return;
  try {
    const audio = new Audio(new URL(url, document.baseURI).href);
    audio.volume = Math.max(0, Math.min(1, volume));
    void audio.play().catch(() => {});
  } catch {
    // 鳴らせなくても続ける
  }
}
