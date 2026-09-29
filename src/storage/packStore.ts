import type { ContentPack } from '@/content';

/** 自作の出題パックの保存先 */
export interface PackStore {
  /** 同じ id があれば上書きする */
  put(pack: ContentPack): Promise<void>;
  list(): Promise<ContentPack[]>;
  remove(id: string): Promise<void>;
}

export function createMemoryPackStore(): PackStore {
  const map = new Map<string, ContentPack>();
  return {
    async put(pack) {
      map.set(pack.id, pack);
    },
    async list() {
      return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
    },
    async remove(id) {
      map.delete(id);
    },
  };
}
