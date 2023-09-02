import { readFile } from 'fs/promises';
import { resolve } from 'path';

function standardizeLineBreaks(str: string) {
  return str.replace(/[\r\n]+/gm, ' ');
}

export async function compareContents(pathToGenerated: string) {
  pathToGenerated = resolve(process.cwd(), pathToGenerated);
  const pathToExpected = pathToGenerated.replace('.generated', '');

  const generatedPromise = readFile(pathToGenerated, { encoding: 'utf-8' });
  const expectedPromise = readFile(pathToExpected, { encoding: 'utf-8' });
  const [generated, expected] = await Promise.all([generatedPromise, expectedPromise]);
  return standardizeLineBreaks(generated) === standardizeLineBreaks(expected);
}
