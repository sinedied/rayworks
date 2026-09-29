import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { generateFunctionsMetadataFiles } from '../node_modules/@microsoft/rayfin-cli/dist/utils/functions-metadata-generator.js';

const functionsRoot = resolve(import.meta.dirname, '../rayfin/functions');

describe('self-contained functions deployment', () => {
  it('keeps relative runtime imports inside the deployed functions folder', () => {
    const sourceRoot = resolve(functionsRoot, 'src');
    const sources = readdirSync(sourceRoot, { recursive: true }).filter(file => typeof file === 'string' && file.endsWith('.ts'));
    for (const source of sources) {
      const file = resolve(sourceRoot, String(source));
      const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      });
      for (const dependency of ts.preProcessFile(outputText).importedFiles) {
        if (!dependency.fileName.startsWith('.')) continue;
        const target = resolve(dirname(file), dependency.fileName.replace(/\.js$/, '.ts'));
        expect(relative(functionsRoot, target), `${source} imports outside its deployable folder`).not.toMatch(/^\.\./);
        expect(existsSync(target), `${source} runtime dependency ${dependency.fileName} is missing`).toBe(true);
      }
    }
  });

  it('advertises all photo operations alongside report generation', async () => {
    const { deployMetadata, runtimeMetadata } = await generateFunctionsMetadataFiles(functionsRoot);
    const names = [
      'beginTripPhotoUpload', 'completeTripPhotoUpload', 'deleteTripPhoto', 'generateTripReport',
    ];
    expect(deployMetadata.functionsMetadata.map(fn => fn.name).sort()).toEqual(names);
    expect(runtimeMetadata.schemaVersion).toBe('2.0');
    expect(runtimeMetadata.functions.map(fn => fn.functionName).sort()).toEqual(names);
    for (const fn of runtimeMetadata.functions) {
      expect(fn.delegateParameters.at(-1)?.type).toMatch(/^RayfinContext(?:<|$)/);
      expect(fn.contextAudiences).toBeInstanceOf(Array);
    }
  });
});
