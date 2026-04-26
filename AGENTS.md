# Repository Guidelines

## Project Structure & Module Organization

This is a Next.js app for generating Korean student record text. Route pages live under `app/`: `app/gwasetuk` for subject records, `app/club` for club records, `app/behavior` for behavior comments, and `app/letter` for home letters. API routes are in `app/api/*`, shared UI is in `components/`, and generation helpers, model calls, validation, Excel export, and text processing live in `utils/`. Tests are in `tests/*.test.mjs`. Static assets are in `public/`, sample spreadsheets are in `sample data/`, and operational notes are kept in `task.md`, `ollama.md`, and `local-llm-api-guide.md`.

## Build, Test, and Development Commands

- `npm run dev`: start the local Next.js dev server, usually at `http://localhost:3000`.
- `npm test`: run all Node test files in `tests/*.test.mjs`.
- `npm run build`: build the production Next.js app and catch route/build errors.
- `npm start`: serve a previously built production app.

Run `npm test` after prompt, validation, model-list, or page-parity changes. Run `npm run build` before larger UI or route changes.

## Coding Style & Naming Conventions

Use JavaScript/React with 4-space indentation, CRLF line endings, UTF-8 BOM, final newlines, and trimmed trailing whitespace as defined in `.editorconfig`. Keep route-specific logic in the matching `app/<route>/page.js`; move shared behavior into `utils/` only when it is reused. Use camelCase for variables/functions, PascalCase for React components, and descriptive helper names such as `generateWithSilentValidation`.

## Testing Guidelines

Tests use Node's built-in test runner with `node:assert/strict`. Name files `*.test.mjs` and keep them focused on observable contracts: prompt rules, validation behavior, model routing, generation progress, and page parity. Prefer source-based regression tests when UI behavior depends on exact prompt or route wiring.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries and occasional Conventional Commit prefixes, for example `feat: tune generation length limits and token budget` and `chore: refresh local llm model list`. Keep commits narrowly scoped. Pull requests should include a concise description, affected routes or utilities, test results, and screenshots for visible UI changes.

## Security & Configuration Tips

Do not commit secrets from `.env` or API keys shown during local testing. When changing local LLM, OpenAI, LM Studio, or external proxy behavior, update the relevant docs and verify error handling for non-200 responses.

## Agent-Specific Instructions

Respond to the repository owner in Korean. Preserve existing Korean UX copy and school-record terminology unless the requested change explicitly updates it.
