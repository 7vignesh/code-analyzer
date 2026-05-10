import { readFileSync } from 'fs';

export class SampleService {
  constructor(private readonly source: string) {}

  load(): string {
    return readFileSync(this.source, 'utf-8');
  }
}

export function formatMessage(name: string): string {
  return `hello ${name}`;
}
