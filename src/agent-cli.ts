#!/usr/bin/env node

/**
 * Agent CLI - Interactive code analysis with Gemini AI
 * This demonstrates the agentic code analysis workflow
 */

import { createCodeAnalysisAgent } from './agent';
import { analyzeProject } from './index';
import * as readline from 'readline';
import * as path from 'path';

interface AgentCliArgs {
  root: string;
  question: string;
  limit: number;
  apiKey?: string;
  model?: string;
  interactive?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): AgentCliArgs | null {
  const args = process.argv.slice(2);

  let root = process.cwd();
  let question = '';
  let limit = 10;
  let apiKey = process.env.GEMINI_API_KEY;
  let model = 'gemini-2.0-flash-exp';
  let interactive = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--root' && i + 1 < args.length) {
      root = args[i + 1];
      i++;
    } else if (arg === '--question' && i + 1 < args.length) {
      question = args[i + 1];
      i++;
    } else if (arg === '--limit' && i + 1 < args.length) {
      limit = parseInt(args[i + 1], 10);
      if (isNaN(limit) || limit < 1) {
        console.error('Error: --limit must be a positive number');
        return null;
      }
      i++;
    } else if (arg === '--api-key' && i + 1 < args.length) {
      apiKey = args[i + 1];
      i++;
    } else if (arg === '--model' && i + 1 < args.length) {
      model = args[i + 1];
      i++;
    } else if (arg === '--interactive' || arg === '-i') {
      interactive = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      return null;
    } else {
      console.error(`Unknown argument: ${arg}`);
      printHelp();
      return null;
    }
  }

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY environment variable or --api-key is required\n');
    return null;
  }

  if (!question && !interactive) {
    console.error('Error: --question is required (or use --interactive for chat mode)\n');
    printHelp();
    return null;
  }

  return { root, question, limit, apiKey, model, interactive };
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
rc-agent - AI-Powered Code Analysis Agent

Usage:
  rc-agent --question "<text>" [options]
  rc-agent --interactive [options]

Options:
  --root <path>        Project root directory (default: current directory)
  --question "<text>"  Question to analyze (required unless --interactive)
  --limit <number>     Number of top files to analyze (default: 10)
  --api-key <key>      Gemini API key (or set GEMINI_API_KEY env var)
  --model <name>       Gemini model name (default: gemini-2.0-flash-exp)
  --interactive, -i    Start interactive chat mode
  --help, -h           Show this help message

Example:
  rc-agent --question "How does authentication work?"
  rc-agent --interactive --root ./my-project
  rc-agent --question "Find all API endpoints" --limit 15

Environment Variables:
  GEMINI_API_KEY       Gemini API key (alternative to --api-key)
  `);
}

/**
 * Run single question mode
 */
async function runSingleQuestion(args: AgentCliArgs): Promise<void> {
  console.log('🔍 Analyzing codebase...\n');

  // Step 1: Generate skeletons with mapping
  const result = await analyzeProject({
    root: args.root,
    question: args.question,
    limit: args.limit,
    generateMapping: true,
  });

  if (result.files.length === 0) {
    console.log('No TypeScript files found.');
    return;
  }

  console.log(`📊 Found ${result.files.length} relevant files\n`);

  // Prepare skeleton context
  const skeletonContext = result.files
    .map(f => `=== ${f.path} (score: ${f.score.toFixed(2)}) ===\n${f.skeleton}`)
    .join('\n\n');

  // Step 2: Create agent and load mapping
  const agent = createCodeAnalysisAgent(args.apiKey!, args.model);
  const mappingPath = path.join(result.root, 'code-analyzer.mapping.json');
  agent.loadMapping(mappingPath);

  const stats = agent.getStats();
  console.log(`📝 Loaded mapping: ${stats.totalFiles} files, ${stats.totalSymbols} symbols\n`);
  console.log(`🤖 Agent is analyzing...\n`);

  // Step 3: Send to agent
  const response = await agent.chat(args.question, skeletonContext);

  console.log('📋 Agent Response:\n');
  console.log(response);
  console.log('\n');
}

/**
 * Run interactive mode
 */
async function runInteractive(args: AgentCliArgs): Promise<void> {
  console.log('🚀 Starting interactive code analysis agent...\n');
  console.log('First, let me analyze your codebase.\n');

  // Step 1: Generate skeletons with mapping
  const result = await analyzeProject({
    root: args.root,
    question: 'code structure and organization',
    limit: args.limit,
    generateMapping: true,
  });

  if (result.files.length === 0) {
    console.log('No TypeScript files found.');
    return;
  }

  console.log(`📊 Analyzed ${result.files.length} files\n`);

  // Prepare skeleton context
  const skeletonContext = result.files
    .map(f => `=== ${f.path} ===\n${f.skeleton}`)
    .join('\n\n');

  // Step 2: Create agent and load mapping
  const agent = createCodeAnalysisAgent(args.apiKey!, args.model);
  const mappingPath = path.join(result.root, 'code-analyzer.mapping.json');
  agent.loadMapping(mappingPath);

  const stats = agent.getStats();
  console.log(`📝 Mapping: ${stats.totalFiles} files, ${stats.totalSymbols} symbols\n`);
  console.log('💬 Ready for questions! (Type "exit" to quit, "stats" for statistics)\n');

  // Step 3: Interactive loop
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('You: ', async (input) => {
      const question = input.trim();

      if (question.toLowerCase() === 'exit') {
        console.log('\n👋 Goodbye!');
        rl.close();
        return;
      }

      if (question.toLowerCase() === 'stats') {
        console.log('\n📊 Statistics:');
        console.log(JSON.stringify(agent.getStats(), null, 2));
        console.log('');
        askQuestion();
        return;
      }

      if (!question) {
        askQuestion();
        return;
      }

      console.log('\n🤖 Agent: ');
      
      try {
        const response = await agent.chat(question, skeletonContext);
        console.log(response);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
      }

      console.log('');
      askQuestion();
    });
  };

  askQuestion();
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  const args = parseArgs();

  if (!args) {
    process.exit(1);
  }

  try {
    if (args.interactive) {
      await runInteractive(args);
    } else {
      await runSingleQuestion(args);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Run CLI
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
