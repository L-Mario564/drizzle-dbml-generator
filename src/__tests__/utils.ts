import { readFileSync, writeFileSync } from 'fs';
import { definePath } from '~/utils';

export function compareWith(generated: string, pathToExpected: string) {
  const path = definePath('__tests__', pathToExpected);
  writeFileSync(path.replace('.dbml', '.generated.dbml'), generated, { encoding: 'utf-8' });
  const expected = readFileSync(path, { encoding: 'utf-8' });
  return generated === expected;
}