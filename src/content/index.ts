import basicJson from './packs/basic.json';
import { loadPack } from './schema';

export { ContentPackSchema, loadPack, validatePackContent } from './schema';
export type { ContentItem, ContentPack } from './schema';

export const BASIC_PACK = loadPack(basicJson);
