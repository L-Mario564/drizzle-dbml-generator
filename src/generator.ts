import { definePath, getCliOptions } from '~/utils';
import { existsSync } from 'fs';
import { pgGenerator } from './generators';

export async function generator() {
  const options = getCliOptions();
  const schemaPath = definePath(options.schema);

  if (!existsSync(schemaPath)) {
    throw new Error(`File located at "${schemaPath}" doesn't exist`);
  }

  if (!schemaPath.endsWith('.js') || !schemaPath.endsWith('.ts')) {
    throw new Error(`File located at "${schemaPath}" isn't a Javascript (.js) or Typescript (.ts) file`);
  }

  const schema = await import(schemaPath);

  let output = '';

  if (options.dialect === 'pg') {
    pgGenerator(schema);
  }
}
