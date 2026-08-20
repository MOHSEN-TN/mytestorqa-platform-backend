# SMART-QA Providers v3 - Ollama streaming hotfix

## Cause corrigee

The live Ollama generation could exceed Node/Undici's response headers timeout when `/api/chat` was called with `stream: false`. The application-level `OLLAMA_TIMEOUT_MS` only controlled the AbortController and did not disable Undici's separate headers timeout.

## Fix

- `/api/chat` now sends `stream: true`.
- Ollama NDJSON chunks are consumed and aggregated inside `OllamaService`.
- The rest of SMART-QA still receives one normal `OllamaChatResult`.
- No frontend change, Prisma migration, or npm dependency is required.

## Validation performed

Targeted runtime tests passed for:

- request body uses `stream: true`;
- NDJSON chunk aggregation;
- JSON mode propagation;
- metrics aggregation;
- compatibility with a non-streaming JSON response;
- preservation of Ollama HTTP error details.

A real test on the user's Windows/Ollama CPU environment is still required.
