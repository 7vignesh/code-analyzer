import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CodeAnalysisAgent } from '../src/agent';
import { buildSkeletonWithMapping, saveMappingToFile, type SymbolMapping } from '../src/mapper';

describe('CodeAnalysisAgent local tool wrappers', () => {
  let tempDir: string;
  let sampleFile: string;
  let mappingPath: string;
  let agent: CodeAnalysisAgent;

  beforeAll(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rc-agent-test-'));
    sampleFile = path.join(tempDir, 'sample.ts');
    mappingPath = path.join(tempDir, 'code-analyzer.mapping.json');

    fs.writeFileSync(
      sampleFile,
      [
        'export class AuthService {',
        '  login(user: string): boolean {',
        '    return user.length > 0;',
        '  }',
        '}',
        '',
        'export function sendMessage(room: string, text: string): string {',
        '  return `${room}:${text}`;',
        '}',
      ].join('\n'),
      'utf-8'
    );

    const mappingResult = buildSkeletonWithMapping(sampleFile, tempDir);
    const mapping: SymbolMapping = {
      generatedAt: new Date().toISOString(),
      rootPath: tempDir,
      files: {
        'sample.ts': {
          originalPath: sampleFile,
          symbols: mappingResult.symbols,
        },
      },
    };

    saveMappingToFile(mapping, mappingPath);

    agent = new CodeAnalysisAgent('test-api-key');
    agent.loadMapping(mappingPath);
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('searchSymbols should find matching symbols', () => {
    const result = agent.searchSymbols('login');
    expect(result.error).toBeUndefined();
    expect(result.count).toBeGreaterThan(0);

    const found = result.results.some((item: any) => item.symbolId === 'AuthService.login');
    expect(found).toBe(true);
  });

  it('getSymbolDetails should return implementation with location', () => {
    const result = agent.getSymbolDetails('sendMessage');
    expect(result.error).toBeUndefined();
    expect(result.content).toContain('return `${room}:${text}`;');
    expect(result.location.file).toBe('sample.ts');
  });

  it('analyzeFileDependencies should return symbol list for file', () => {
    const result = agent.analyzeFileDependencies('sample.ts');
    expect(result.error).toBeUndefined();
    expect(result.file).toBe('sample.ts');
    expect(Array.isArray(result.symbols)).toBe(true);
    expect(result.symbols.length).toBeGreaterThan(0);
  });
});
