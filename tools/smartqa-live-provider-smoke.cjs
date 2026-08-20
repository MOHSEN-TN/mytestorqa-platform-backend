const fs = require('node:fs');
const path = require('node:path');

const {
  OllamaService,
} = require('../src/AiExploration/ollama/ollama.service');
const {
  GeminiService,
} = require('../src/AiExploration/gemini/gemini.service');
const {
  OllamaTestGeneratorService,
} = require('../src/AiExploration/generator/ollama-test-generator.service');
const {
  GeminiTestGeneratorService,
} = require('../src/AiExploration/generator/gemini-test-generator.service');
const {
  AITestPrioritizerService,
} = require('../src/AiExploration/prioritization/ai-test-prioritizer.service');

function readArgument(name, fallback) {
  const prefix = `--${name}=`;
  const value = process.argv.find((argument) => argument.startsWith(prefix));
  return value ? value.slice(prefix.length).trim() : fallback;
}

function buildInput() {
  const targetUrl = readArgument('url', 'https://example.com');

  return {
    title: 'SMART-QA live provider smoke test',
    prompt:
      'Génère deux scénarios de test courts, observables et directement exploitables.',
    context: 'Test technique minimal du générateur SMART-QA.',
    targetUrl,
    generatePlaywright: true,
    generateGherkin: false,
    generateNegativeTests: false,
    explorationResult: {
      startUrl: targetUrl,
      depth: 1,
      errors: [],
      pages: [
        {
          url: targetUrl,
          title: 'Example Domain',
          headings: ['Example Domain'],
          links: [
            {
              text: 'More information',
              href: 'https://www.iana.org/help/example-domains',
            },
          ],
          buttons: [],
          inputs: [],
          forms: [],
          consoleErrors: [],
        },
      ],
    },
  };
}

function summarize(provider, result) {
  return {
    provider,
    ok: true,
    model: result.metrics?.model || null,
    durationMs: result.metrics?.totalDurationMs || null,
    promptTokens: result.metrics?.promptTokens || null,
    completionTokens: result.metrics?.completionTokens || null,
    attempts: result.metrics?.requestAttempts || 1,
    outputMode: result.metrics?.outputMode || null,
    suggestionCount: result.suggestions.length,
    suggestions: result.suggestions.map((suggestion) => ({
      title: suggestion.title,
      priority: suggestion.priority,
      sourcePageUrl: suggestion.sourcePageUrl,
      stepCount: suggestion.steps?.length || 0,
    })),
  };
}

function summarizeError(provider, error) {
  const response =
    error && typeof error.getResponse === 'function'
      ? error.getResponse()
      : undefined;

  return {
    provider,
    ok: false,
    message: error instanceof Error ? error.message : String(error),
    response: response || null,
  };
}

async function runProvider(provider, input) {
  const prioritizer = new AITestPrioritizerService();

  if (provider === 'ollama') {
    process.env.OLLAMA_TEST_MAX_SUGGESTIONS =
      process.env.OLLAMA_TEST_MAX_SUGGESTIONS || '2';
    const generator = new OllamaTestGeneratorService(
      new OllamaService(),
      prioritizer,
    );
    return summarize('OLLAMA_LOCAL', await generator.generate(input));
  }

  if (provider === 'gemini') {
    process.env.GEMINI_TEST_MAX_SUGGESTIONS =
      process.env.GEMINI_TEST_MAX_SUGGESTIONS || '2';
    const generator = new GeminiTestGeneratorService(
      new GeminiService(),
      prioritizer,
    );
    return summarize('CLOUD_AI', await generator.generate(input));
  }

  throw new Error(`Fournisseur inconnu : ${provider}`);
}

async function main() {
  const requested = readArgument('provider', 'both').toLowerCase();
  const providers =
    requested === 'both' ? ['ollama', 'gemini'] : [requested];
  const input = buildInput();
  const results = [];

  for (const provider of providers) {
    const startedAt = Date.now();

    try {
      const result = await runProvider(provider, input);
      results.push({ ...result, wallClockMs: Date.now() - startedAt });
    } catch (error) {
      results.push({
        ...summarizeError(provider.toUpperCase(), error),
        wallClockMs: Date.now() - startedAt,
      });
    }
  }

  const report = {
    executedAt: new Date().toISOString(),
    targetUrl: input.targetUrl,
    results,
  };
  const outputPath = path.resolve('smartqa-live-smoke-output.json');

  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nRapport écrit dans : ${outputPath}`);

  if (results.some((result) => !result.ok)) {
    process.exitCode = 1;
  }
}

void main();
