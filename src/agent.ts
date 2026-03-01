/**
 * Gemini AI Agent Integration for Code Analysis
 * This module provides tool definitions and agent setup for agentic code analysis
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { getSymbolDetails, loadMappingFromFile, type SymbolMapping } from './mapper';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Tool definition for getting symbol details
 */
export const getSymbolDetailsTool = {
  name: 'get_symbol_details',
  description: `Retrieve the full implementation of a code symbol (function, method, class) from the original source file.
Use this when you need to see the actual implementation of a function or method that was marked with [SYMBOL:...] in the skeleton.
The symbolId is in the format "ClassName.methodName" or "functionName" for top-level functions.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      symbolId: {
        type: SchemaType.STRING,
        description: 'The symbol identifier from the skeleton code (e.g., "AuthService.login" or "sendMessage")',
      },
    },
    required: ['symbolId'],
  },
};

/**
 * Tool definition for searching code symbols
 */
export const searchSymbolsTool = {
  name: 'search_symbols',
  description: `Search for available symbols in the generated skeletons. Returns a list of matching symbols that can be retrieved using get_symbol_details.
Use this to discover what functions/methods are available before requesting their full implementation.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      query: {
        type: SchemaType.STRING,
        description: 'Search query to match against symbol names, file paths, or signatures',
      },
      symbolType: {
        type: SchemaType.STRING,
        description: 'Optional filter by symbol type: function, method, constructor, arrow-function, variable',
        enum: ['function', 'method', 'constructor', 'arrow-function', 'variable'],
      },
    },
    required: ['query'],
  },
};

/**
 * Tool definition for analyzing file dependencies
 */
export const analyzeFileDependenciesTool = {
  name: 'analyze_file_dependencies',
  description: `Analyze import/export relationships for a specific file from the skeleton.
Use this to understand what other files a given file depends on.`,
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      filePath: {
        type: SchemaType.STRING,
        description: 'Relative path to the file (as shown in the skeleton)',
      },
    },
    required: ['filePath'],
  },
};

/**
 * Code Analysis Agent
 */
export class CodeAnalysisAgent {
  private genAI: GoogleGenerativeAI;
  private mapping: SymbolMapping | null = null;
  private model: any;

  constructor(apiKey: string, modelName: string = 'gemini-2.0-flash-exp') {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      tools: [
        {
          functionDeclarations: [
            getSymbolDetailsTool,
            searchSymbolsTool,
            analyzeFileDependenciesTool,
          ],
        },
      ],
    });
  }

  /**
   * Load symbol mapping
   */
  loadMapping(mappingPath: string): void {
    if (!fs.existsSync(mappingPath)) {
      throw new Error(`Mapping file not found: ${mappingPath}`);
    }
    this.mapping = loadMappingFromFile(mappingPath);
    console.log(`Loaded mapping with ${Object.keys(this.mapping.files).length} files`);
  }

  /**
   * Handle tool calls from the model
   */
  private async handleToolCall(functionCall: any): Promise<any> {
    const { name, args } = functionCall;

    switch (name) {
      case 'get_symbol_details':
        return this.handleGetSymbolDetails(args.symbolId);
      
      case 'search_symbols':
        return this.handleSearchSymbols(args.query, args.symbolType);
      
      case 'analyze_file_dependencies':
        return this.handleAnalyzeFileDependencies(args.filePath);
      
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  /**
   * Get symbol details
   */
  private handleGetSymbolDetails(symbolId: string): any {
    if (!this.mapping) {
      return { error: 'No mapping loaded. Please load a mapping file first.' };
    }

    const result = getSymbolDetails(symbolId, this.mapping);
    if (!result) {
      return { error: `Symbol not found: ${symbolId}` };
    }

    return {
      symbolId,
      content: result.content,
      location: {
        file: result.location.filePath,
        lines: `${result.location.startLine}-${result.location.endLine}`,
        type: result.location.symbolType,
        parentClass: result.location.parentClass,
      },
    };
  }

  /**
   * Search symbols
   */
  private handleSearchSymbols(query: string, symbolType?: string): any {
    if (!this.mapping) {
      return { error: 'No mapping loaded. Please load a mapping file first.' };
    }

    const results: any[] = [];
    const queryLower = query.toLowerCase();

    for (const [filePath, fileInfo] of Object.entries(this.mapping.files)) {
      for (const symbol of fileInfo.symbols) {
        // Filter by type if specified
        if (symbolType && symbol.symbolType !== symbolType) {
          continue;
        }

        // Check if query matches
        const matchesName = symbol.symbolName.toLowerCase().includes(queryLower);
        const matchesFile = filePath.toLowerCase().includes(queryLower);
        const matchesSignature = symbol.signature?.toLowerCase().includes(queryLower);

        if (matchesName || matchesFile || matchesSignature) {
          results.push({
            symbolId: symbol.symbolId,
            name: symbol.symbolName,
            type: symbol.symbolType,
            file: filePath,
            parentClass: symbol.parentClass,
            signature: symbol.signature,
          });
        }
      }
    }

    return {
      query,
      count: results.length,
      results: results.slice(0, 20), // Limit to 20 results
    };
  }

  /**
   * Analyze file dependencies
   */
  private handleAnalyzeFileDependencies(filePath: string): any {
    if (!this.mapping) {
      return { error: 'No mapping loaded. Please load a mapping file first.' };
    }

    const fileInfo = this.mapping.files[filePath];
    if (!fileInfo) {
      return { error: `File not found in mapping: ${filePath}` };
    }

    // Read the original file to extract imports
    const fullPath = path.join(this.mapping.rootPath, filePath);
    if (!fs.existsSync(fullPath)) {
      return { error: `Source file not found: ${fullPath}` };
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    const importRegex = /import\s+(?:{[^}]*}|[^;]+)\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    return {
      file: filePath,
      imports,
      symbolCount: fileInfo.symbols.length,
      symbols: fileInfo.symbols.map(s => ({
        id: s.symbolId,
        name: s.symbolName,
        type: s.symbolType,
      })),
    };
  }

  /**
   * Start a conversation with the agent
   */
  async chat(userMessage: string, skeletonContext?: string): Promise<string> {
    if (!this.mapping) {
      throw new Error('No mapping loaded. Call loadMapping() first.');
    }

    let context = userMessage;
    if (skeletonContext) {
      context = `Here are the code skeletons for context:\n\n${skeletonContext}\n\nUser question: ${userMessage}`;
    }

    const chat = this.model.startChat({
      history: [],
    });

    let response = await chat.sendMessage(context);
    let responseText = '';

    // Handle function calls in a loop
    while (response.response.functionCalls()) {
      const functionCalls = response.response.functionCalls();
      const functionResponses: any[] = [];

      for (const call of functionCalls) {
        console.log(`[Agent] Calling tool: ${call.name}(${JSON.stringify(call.args)})`);
        const result = await this.handleToolCall(call);
        functionResponses.push({
          name: call.name,
          response: result,
        });
      }

      // Send function responses back to the model
      response = await chat.sendMessage(functionResponses);
    }

    responseText = response.response.text();
    return responseText;
  }

  /**
   * Get statistics about the loaded mapping
   */
  getStats(): any {
    if (!this.mapping) {
      return { error: 'No mapping loaded' };
    }

    let totalSymbols = 0;
    const symbolTypes: { [key: string]: number } = {};

    for (const fileInfo of Object.values(this.mapping.files)) {
      totalSymbols += fileInfo.symbols.length;
      for (const symbol of fileInfo.symbols) {
        symbolTypes[symbol.symbolType] = (symbolTypes[symbol.symbolType] || 0) + 1;
      }
    }

    return {
      rootPath: this.mapping.rootPath,
      generatedAt: this.mapping.generatedAt,
      totalFiles: Object.keys(this.mapping.files).length,
      totalSymbols,
      symbolsByType: symbolTypes,
    };
  }
}

/**
 * Helper function to create an agent instance
 */
export function createCodeAnalysisAgent(apiKey: string, modelName?: string): CodeAnalysisAgent {
  return new CodeAnalysisAgent(apiKey, modelName);
}
