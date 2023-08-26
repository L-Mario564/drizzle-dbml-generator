import path from 'path';
import { fileURLToPath } from 'url';

export function definePath(...paths: string[]) {
  const __filename = fileURLToPath(import.meta.url);
  const distPath = path.dirname(__filename);
  return path.join(distPath, '../', ...paths);
}
