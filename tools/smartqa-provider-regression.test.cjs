const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

const {
  compactExplorationSnapshot,
  buildTestGenerationPrompt,
  parseGeneratedPayload,
  normalizeGeneratedSuggestions,
  collectAllowedUrls,
  OLLAMA_SNAPSHOT_PROFILE,
} = require('../src/AiExploration/generator/shared/test-generation.shared');
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

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_ENV = { ...process.env };

function sampleExploration(overrides = {}) {
  return {
    startUrl: 'https://example.com',
    depth: 1,
    errors: [],
    pages: [
      {
        url: 'https://example.com',
        title: 'Example',
        headings: ['Example Domain'],
        links: [{ text: 'More', href: 'https://example.com/more' }],
        buttons: [{ text: 'Continue' }],
        inputs: [
          {
            name: 'email',
            type: 'email',
            placeholder: 'Email',
            label: 'Email',
          },
        ],
        forms: [
          {
            action: 'https://example.com/login',
            method: 'POST',
            inputs: [
              {
                name: 'email',
                type: 'email',
                placeholder: 'Email',
                label: 'Email',
              },
            ],
          },
        ],
        consoleErrors: [],
      },
    ],
    ...overrides,
  };
}

function generationInput(overrides = {}) {
  return {
    title: 'Test Example',
    prompt: 'Générer des tests prioritaires',
    context: 'Application publique simple',
    targetUrl: 'https://example.com',
    generatePlaywright: true,
    generateGherkin: false,
    generateNegativeTests: false,
    explorationResult: sampleExploration(),
    ...overrides,
  };
}

function validPayload(count = 1) {
  return {
    summary: 'Résumé',
    suggestions: Array.from({ length: count }, (_, index) => ({
      title: `Scénario ${index + 1}`,
      description: `Description du scénario ${index + 1}`,
      expectedResult: `Résultat attendu ${index + 1}`,
      priority: 'HIGH',
      sourcePageUrl: 'https://example.com',
      confidence: 0.8,
      steps: [
        {
          action: 'Ouvrir la page',
          expected: 'La page est visible',
        },
      ],
      gherkin: '',
    })),
  };
}

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(
    typeof body === 'string' ? body : JSON.stringify(body),
    {
      status,
      headers: {
        'content-type': 'application/json',
        ...headers,
      },
    },
  );
}

function ollamaTags(model = 'qwen3.5:9b') {
  return jsonResponse({
    models: [
      {
        name: model,
        model,
        size: 6_500_000_000,
        details: {
          parameter_size: '9.7B',
          quantization_level: 'Q4_K_M',
        },
      },
    ],
  });
}

function ollamaChat(content = JSON.stringify(validPayload())) {
  return jsonResponse({
    model: 'qwen3.5:9b',
    message: { role: 'assistant', content },
    done_reason: 'stop',
    total_duration: 2_000_000,
    load_duration: 1_000_000,
    prompt_eval_count: 100,
    eval_count: 50,
  });
}

function geminiContent(content = JSON.stringify(validPayload())) {
  return jsonResponse({
    candidates: [
      {
        finishReason: 'STOP',
        content: { parts: [{ text: content }] },
      },
    ],
    usageMetadata: {
      promptTokenCount: 120,
      candidatesTokenCount: 60,
      totalTokenCount: 180,
    },
  });
}

function setBaseEnv() {
  process.env.OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
  process.env.OLLAMA_MODEL = 'qwen3.5:9b';
  process.env.OLLAMA_MAX_RETRIES = '0';
  process.env.OLLAMA_STATUS_CACHE_MS = '60000';
  process.env.OLLAMA_SERIALIZE_REQUESTS = 'true';
  process.env.OLLAMA_TEST_SAFE_RETRY = 'true';
  process.env.OLLAMA_RECOVERY_WAIT_MS = '2000';
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.GEMINI_MODEL = 'gemini-3.6-flash';
  process.env.GEMINI_MAX_RETRIES = '0';
  process.env.GEMINI_STATUS_CACHE_MS = '300000';
}

beforeEach(() => {
  setBaseEnv();
});

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  process.env = { ...ORIGINAL_ENV };
});

// ---------------------------------------------------------------------------
// 1-20 : Snapshot, prompt, parsing and normalization
// ---------------------------------------------------------------------------

test('01 compact snapshot limits the number of pages', () => {
  const pages = Array.from({ length: 10 }, (_, index) => ({
    ...sampleExploration().pages[0],
    url: `https://example.com/${index}`,
  }));
  const snapshot = compactExplorationSnapshot(
    sampleExploration({ pages }),
    { ...OLLAMA_SNAPSHOT_PROFILE, maxPages: 3 },
  );
  assert.equal(snapshot.pages.length, 3);
});

test('02 compact snapshot respects the character budget', () => {
  const huge = 'x'.repeat(5_000);
  const result = sampleExploration({
    pages: [
      {
        ...sampleExploration().pages[0],
        headings: Array.from({ length: 50 }, () => huge),
        links: Array.from({ length: 50 }, (_, index) => ({
          text: huge,
          href: `https://example.com/${index}`,
        })),
      },
    ],
  });
  const snapshot = compactExplorationSnapshot(result, {
    ...OLLAMA_SNAPSHOT_PROFILE,
    maxCharacters: 3_000,
  });
  assert.ok(JSON.stringify(snapshot).length <= 3_000);
});

test('03 compact snapshot sanitizes null characters and whitespace', () => {
  const snapshot = compactExplorationSnapshot(
    sampleExploration({
      pages: [
        {
          ...sampleExploration().pages[0],
          title: '  Hello\u0000   world  ',
        },
      ],
    }),
    OLLAMA_SNAPSHOT_PROFILE,
  );
  assert.equal(snapshot.pages[0].title, 'Hello world');
});

test('04 prompt contains the maximum number of suggestions', () => {
  const snapshot = compactExplorationSnapshot(
    sampleExploration(),
    OLLAMA_SNAPSHOT_PROFILE,
  );
  const prompt = buildTestGenerationPrompt(
    generationInput(),
    snapshot,
    5,
    'Ollama local',
  );
  assert.match(prompt, /entre 1 et 5 scénarios/);
});

test('05 prompt encloses Playwright data in explicit tags', () => {
  const snapshot = compactExplorationSnapshot(
    sampleExploration(),
    OLLAMA_SNAPSHOT_PROFILE,
  );
  const prompt = buildTestGenerationPrompt(
    generationInput(),
    snapshot,
    5,
    'Ollama local',
  );
  assert.match(prompt, /<playwright_snapshot>/);
  assert.match(prompt, /<\/playwright_snapshot>/);
});

test('06 prompt disables Gherkin explicitly', () => {
  const snapshot = compactExplorationSnapshot(
    sampleExploration(),
    OLLAMA_SNAPSHOT_PROFILE,
  );
  const prompt = buildTestGenerationPrompt(
    generationInput({ generateGherkin: false }),
    snapshot,
    3,
    'Gemini Cloud',
  );
  assert.match(prompt, /chaîne vide dans le champ gherkin/);
});

test('07 parser accepts plain JSON', () => {
  const payload = parseGeneratedPayload(
    JSON.stringify(validPayload()),
    'Test',
  );
  assert.equal(payload.suggestions.length, 1);
});

test('08 parser accepts fenced JSON', () => {
  const payload = parseGeneratedPayload(
    `\`\`\`json\n${JSON.stringify(validPayload())}\n\`\`\``,
    'Test',
  );
  assert.equal(payload.suggestions.length, 1);
});

test('09 parser extracts JSON from surrounding text', () => {
  const payload = parseGeneratedPayload(
    `Voici le résultat: ${JSON.stringify(validPayload())} fin`,
    'Test',
  );
  assert.equal(payload.summary, 'Résumé');
});

test('10 parser rejects invalid JSON', () => {
  assert.throws(
    () => parseGeneratedPayload('not-json', 'Test'),
    /invalide/,
  );
});

test('11 normalizer rejects a non-array suggestions value', () => {
  const normalized = normalizeGeneratedSuggestions(
    {},
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.deepEqual(normalized, []);
});

test('12 normalizer removes duplicate titles', () => {
  const payload = validPayload(2);
  payload.suggestions[1].title = payload.suggestions[0].title.toUpperCase();
  const normalized = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(normalized.length, 1);
});

test('13 normalizer clamps confidence above one', () => {
  const payload = validPayload();
  payload.suggestions[0].confidence = 4;
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(suggestion.aiConfidence, 1);
});

test('14 normalizer clamps confidence below zero', () => {
  const payload = validPayload();
  payload.suggestions[0].confidence = -2;
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(suggestion.aiConfidence, 0);
});

test('15 normalizer defaults invalid confidence to 0.7', () => {
  const payload = validPayload();
  payload.suggestions[0].confidence = 'unknown';
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(suggestion.aiConfidence, 0.7);
});

test('16 normalizer rejects invented source URLs', () => {
  const payload = validPayload();
  payload.suggestions[0].sourcePageUrl = 'https://invented.example';
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(suggestion.sourcePageUrl, 'https://example.com');
});

test('17 normalizer preserves an observed source URL', () => {
  const payload = validPayload();
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(suggestion.sourcePageUrl, 'https://example.com');
});

test('18 normalizer removes Gherkin when disabled', () => {
  const payload = validPayload();
  payload.suggestions[0].gherkin = 'Feature: A';
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput({ generateGherkin: false }),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(suggestion.gherkin, '');
});

test('19 normalizer creates a fallback step when steps are missing', () => {
  const payload = validPayload();
  delete payload.suggestions[0].steps;
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'MEDIUM' },
    5,
  );
  assert.equal(suggestion.steps.length, 1);
  assert.match(suggestion.steps[0].action, /Ouvrir la page/);
});

test('20 normalizer uses prioritizer for an invalid priority', () => {
  const payload = validPayload();
  payload.suggestions[0].priority = 'URGENT';
  const [suggestion] = normalizeGeneratedSuggestions(
    payload.suggestions,
    new Set(['https://example.com']),
    generationInput(),
    { prioritize: () => 'CRITICAL' },
    5,
  );
  assert.equal(suggestion.priority, 'CRITICAL');
});

// ---------------------------------------------------------------------------
// 21-35 : Ollama transport, caching, serialization and payloads
// ---------------------------------------------------------------------------

test('21 Ollama status reports the installed model', async () => {
  global.fetch = async (url) =>
    String(url).endsWith('/api/version')
      ? jsonResponse({ version: '0.32.5' })
      : ollamaTags();
  const status = await new OllamaService().getStatus(true);
  assert.equal(status.available, true);
  assert.equal(status.modelInstalled, true);
});

test('22 Ollama status cache avoids duplicate HTTP calls', async () => {
  let calls = 0;
  global.fetch = async (url) => {
    calls += 1;
    return String(url).endsWith('/api/version')
      ? jsonResponse({ version: '0.32.5' })
      : ollamaTags();
  };
  const service = new OllamaService();
  await service.getStatus(true);
  await service.getStatus();
  assert.equal(calls, 2);
});

test('23 Ollama status detects a missing configured model', async () => {
  global.fetch = async (url) =>
    String(url).endsWith('/api/version')
      ? jsonResponse({ version: '0.32.5' })
      : ollamaTags('other:latest');
  const status = await new OllamaService().getStatus(true);
  assert.equal(status.modelInstalled, false);
});

test('24 Ollama chat sends think false by default', async () => {
  let body;
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    body = JSON.parse(init.body);
    return ollamaChat('Bonjour');
  };
  await new OllamaService().chat({
    messages: [{ role: 'user', content: 'Bonjour' }],
  });
  assert.equal(body.think, false);
});

test('25 Ollama chat sends JSON mode when requested', async () => {
  let body;
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    body = JSON.parse(init.body);
    return ollamaChat();
  };
  await new OllamaService().chat({
    messages: [{ role: 'user', content: 'JSON' }],
    format: 'json',
  });
  assert.equal(body.format, 'json');
});

test('26 Ollama chat omits format when not requested', async () => {
  let body;
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    body = JSON.parse(init.body);
    return ollamaChat('OK');
  };
  await new OllamaService().chat({
    messages: [{ role: 'user', content: 'Texte' }],
  });
  assert.equal('format' in body, false);
});

test('27 Ollama chat rejects an empty message list', async () => {
  await assert.rejects(
    () => new OllamaService().chat({ messages: [] }),
    /Aucun message exploitable/,
  );
});

test('28 Ollama chat rejects an empty model response', async () => {
  global.fetch = async (url) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    return ollamaChat('   ');
  };
  await assert.rejects(
    () =>
      new OllamaService().chat({
        messages: [{ role: 'user', content: 'Test' }],
      }),
    /réponse vide/,
  );
});

test('29 Ollama exposes HTTP error details', async () => {
  global.fetch = async (url) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    return jsonResponse({ error: 'failed to parse grammar' }, 400);
  };
  await assert.rejects(
    () =>
      new OllamaService().chat({
        messages: [{ role: 'user', content: 'Test' }],
      }),
    /failed to parse grammar/,
  );
});

test('30 Ollama timeout becomes an explicit timeout error', async () => {
  global.fetch = async (url, init) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    return new Promise((_, reject) => {
      init.signal.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    });
  };
  await assert.rejects(
    () =>
      new OllamaService().chat({
        messages: [{ role: 'user', content: 'Test' }],
        timeoutMs: 10,
      }),
    /délai de 10 ms/,
  );
});

test('31 Ollama transport error includes the underlying cause', async () => {
  global.fetch = async (url) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    const error = new TypeError('fetch failed');
    error.cause = { code: 'UND_ERR_SOCKET', message: 'other side closed' };
    throw error;
  };
  await assert.rejects(
    () =>
      new OllamaService().chat({
        messages: [{ role: 'user', content: 'Test' }],
      }),
    /UND_ERR_SOCKET/,
  );
});

test('32 Ollama serializes two heavy requests', async () => {
  const events = [];
  let chatIndex = 0;
  global.fetch = async (url) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    const current = ++chatIndex;
    events.push(`start-${current}`);
    await new Promise((resolve) => setTimeout(resolve, 15));
    events.push(`end-${current}`);
    return ollamaChat(`answer-${current}`);
  };
  const service = new OllamaService();
  await Promise.all([
    service.chat({ messages: [{ role: 'user', content: 'A' }] }),
    service.chat({ messages: [{ role: 'user', content: 'B' }] }),
  ]);
  assert.deepEqual(events, ['start-1', 'end-1', 'start-2', 'end-2']);
});

test('33 Ollama waitUntilReady succeeds after a transient failure', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('fetch failed');
    return ollamaTags();
  };
  const ready = await new OllamaService().waitUntilReady(100, 1);
  assert.equal(ready, true);
});

test('34 Ollama normalizes latest model tags', async () => {
  global.fetch = async (url) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags('qwen3.5:9b:latest');
    return ollamaChat('OK');
  };
  process.env.OLLAMA_MODEL = 'qwen3.5:9b:latest';
  const result = await new OllamaService().chat({
    messages: [{ role: 'user', content: 'Test' }],
  });
  assert.equal(result.content, 'OK');
});

test('35 Ollama converts nanosecond metrics to milliseconds', async () => {
  global.fetch = async (url) => {
    if (String(url).endsWith('/api/tags')) return ollamaTags();
    return ollamaChat('OK');
  };
  const result = await new OllamaService().chat({
    messages: [{ role: 'user', content: 'Test' }],
  });
  assert.equal(result.metrics.totalDurationMs, 2);
  assert.equal(result.metrics.loadDurationMs, 1);
});

// ---------------------------------------------------------------------------
// 36-45 : Gemini configuration, quota, retries and structured output
// ---------------------------------------------------------------------------

test('36 Gemini status reports a missing API key', async () => {
  delete process.env.GEMINI_API_KEY;
  const status = await new GeminiService().getStatus(true);
  assert.equal(status.configured, false);
  assert.equal(status.available, false);
});

test('37 Gemini status validates the configured model', async () => {
  global.fetch = async () =>
    jsonResponse({ version: '3.6', displayName: 'Gemini 3.6 Flash' });
  const status = await new GeminiService().getStatus(true);
  assert.equal(status.available, true);
  assert.equal(status.configuredModel, 'gemini-3.6-flash');
});

test('38 Gemini status cache avoids duplicate model calls', async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return jsonResponse({ version: '3.6' });
  };
  const service = new GeminiService();
  await service.getStatus(true);
  await service.getStatus();
  assert.equal(calls, 1);
});

test('39 Gemini chat sends the API key header and model path', async () => {
  let request;
  global.fetch = async (url, init) => {
    request = { url: String(url), init };
    return geminiContent('Bonjour');
  };
  await new GeminiService().chat({
    messages: [{ role: 'user', content: 'Bonjour' }],
  });
  assert.match(request.url, /gemini-3\.6-flash:generateContent/);
  assert.equal(new Headers(request.init.headers).get('x-goog-api-key'), 'test-key');
});

test('40 Gemini structured output uses responseFormat', async () => {
  let body;
  global.fetch = async (_url, init) => {
    body = JSON.parse(init.body);
    return geminiContent();
  };
  await new GeminiService().chat({
    messages: [{ role: 'user', content: 'JSON' }],
    responseSchema: { type: 'object' },
  });
  assert.equal(
    body.generationConfig.responseFormat.text.mimeType,
    'application/json',
  );
});

test('41 Gemini falls back to legacy schema fields on compatibility HTTP 400', async () => {
  const bodies = [];
  global.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    if (bodies.length === 1) {
      return jsonResponse({ error: { message: 'Unknown field responseFormat' } }, 400);
    }
    return geminiContent();
  };
  await new GeminiService().chat({
    messages: [{ role: 'user', content: 'JSON' }],
    responseSchema: { type: 'object' },
  });
  assert.equal(bodies.length, 2);
  assert.equal(
    bodies[1].generationConfig.responseMimeType,
    'application/json',
  );
});

test('42 Gemini HTTP 429 is not retried immediately', async () => {
  process.env.GEMINI_MAX_RETRIES = '2';
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return jsonResponse(
      { error: { message: 'Quota exceeded' } },
      429,
      { 'retry-after': '60' },
    );
  };
  await assert.rejects(
    () =>
      new GeminiService().chat({
        messages: [{ role: 'user', content: 'Test' }],
      }),
    (error) => {
      const status = typeof error.getStatus === 'function'
        ? error.getStatus()
        : error.status;
      return status === 429;
    },
  );
  assert.equal(calls, 1);
});

test('43 Gemini retries a transient HTTP 500', async () => {
  process.env.GEMINI_MAX_RETRIES = '1';
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return calls === 1
      ? jsonResponse({ error: { message: 'Temporary' } }, 500)
      : geminiContent('OK');
  };
  const result = await new GeminiService().chat({
    messages: [{ role: 'user', content: 'Test' }],
  });
  assert.equal(result.content, 'OK');
  assert.equal(calls, 2);
});

test('44 Gemini rejects an empty candidate response', async () => {
  global.fetch = async () => jsonResponse({ candidates: [] });
  await assert.rejects(
    () =>
      new GeminiService().chat({
        messages: [{ role: 'user', content: 'Test' }],
      }),
    /réponse vide/,
  );
});

test('45 Gemini excludes thought parts from final content', async () => {
  global.fetch = async () =>
    jsonResponse({
      candidates: [
        {
          content: {
            parts: [
              { text: 'internal reasoning', thought: true },
              { text: 'final answer' },
            ],
          },
        },
      ],
    });
  const result = await new GeminiService().chat({
    messages: [{ role: 'user', content: 'Test' }],
  });
  assert.equal(result.content, 'final answer');
});

// ---------------------------------------------------------------------------
// 46-50 : Provider-specific test generators
// ---------------------------------------------------------------------------

test('46 Ollama generator produces normalized suggestions in JSON mode', async () => {
  const calls = [];
  const service = new OllamaTestGeneratorService(
    {
      getModelName: () => 'qwen3.5:9b',
      waitUntilReady: async () => true,
      chat: async (input) => {
        calls.push(input);
        return {
          model: 'qwen3.5:9b',
          content: JSON.stringify(validPayload(2)),
          metrics: { totalDurationMs: 1000 },
        };
      },
    },
    { prioritize: () => 'MEDIUM' },
  );
  const result = await service.generate(generationInput());
  assert.equal(result.suggestions.length, 2);
  assert.equal(calls[0].format, 'json');
  assert.equal(calls[0].think, false);
});

test('47 Ollama generator retries without grammar after a grammar error', async () => {
  const formats = [];
  let calls = 0;
  const service = new OllamaTestGeneratorService(
    {
      getModelName: () => 'qwen3.5:9b',
      waitUntilReady: async () => true,
      chat: async (input) => {
        calls += 1;
        formats.push(input.format);
        if (calls === 1) throw new Error('failed to parse grammar');
        return {
          model: 'qwen3.5:9b',
          content: JSON.stringify(validPayload()),
          metrics: {},
        };
      },
    },
    { prioritize: () => 'MEDIUM' },
  );
  const result = await service.generate(generationInput());
  assert.equal(result.suggestions.length, 1);
  assert.deepEqual(formats, ['json', undefined]);
  assert.equal(result.metrics.requestAttempts, 2);
});

test('48 Ollama generator uses safe retry after a transport failure', async () => {
  let calls = 0;
  let waits = 0;
  const service = new OllamaTestGeneratorService(
    {
      getModelName: () => 'qwen3.5:9b',
      waitUntilReady: async () => {
        waits += 1;
        return true;
      },
      chat: async () => {
        calls += 1;
        if (calls === 1) throw new Error('fetch failed UND_ERR_SOCKET');
        return {
          model: 'qwen3.5:9b',
          content: JSON.stringify(validPayload()),
          metrics: {},
        };
      },
    },
    { prioritize: () => 'MEDIUM' },
  );
  const result = await service.generate(generationInput());
  assert.equal(waits, 1);
  assert.equal(result.metrics.outputMode, 'PROMPT_JSON');
});

test('49 Gemini generator performs one structured provider call', async () => {
  let calls = 0;
  let received;
  const service = new GeminiTestGeneratorService(
    {
      getModelName: () => 'gemini-3.6-flash',
      chat: async (input) => {
        calls += 1;
        received = input;
        return {
          model: 'gemini-3.6-flash',
          content: JSON.stringify(validPayload(2)),
          metrics: { promptTokens: 100, completionTokens: 50 },
        };
      },
    },
    { prioritize: () => 'MEDIUM' },
  );
  const result = await service.generate(generationInput());
  assert.equal(calls, 1);
  assert.equal(result.suggestions.length, 2);
  assert.ok(received.responseSchema);
  assert.equal(result.metrics.outputMode, 'JSON_SCHEMA');
});

test('50 both providers share the same Playwright-only source URL policy', async () => {
  const payload = validPayload();
  payload.suggestions[0].sourcePageUrl = 'https://hallucinated.example';
  const response = {
    model: 'model',
    content: JSON.stringify(payload),
    metrics: {},
  };
  const prioritizer = { prioritize: () => 'MEDIUM' };
  const ollama = new OllamaTestGeneratorService(
    {
      getModelName: () => 'qwen3.5:9b',
      waitUntilReady: async () => true,
      chat: async () => response,
    },
    prioritizer,
  );
  const gemini = new GeminiTestGeneratorService(
    {
      getModelName: () => 'gemini-3.6-flash',
      chat: async () => response,
    },
    prioritizer,
  );
  const [localResult, cloudResult] = await Promise.all([
    ollama.generate(generationInput()),
    gemini.generate(generationInput()),
  ]);
  assert.equal(localResult.suggestions[0].sourcePageUrl, 'https://example.com');
  assert.equal(cloudResult.suggestions[0].sourcePageUrl, 'https://example.com');
});
