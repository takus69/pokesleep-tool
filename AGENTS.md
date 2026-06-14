# AGENTS.md

## Repository Overview

This repository is a React 19, TypeScript, Vite, and Material UI web application for Pokémon Sleep. It contains two applications selected by URL in `src/ui/App.tsx`:

- **Research Calc** (`/pokesleep-tool/`) - Drowsy Power and sleep research calculations.
- **IV Calc** (`/pokesleep-tool/iv/`) - Pokémon IV, RP, strength, rating, and box management.

Vite builds both applications for five languages: English, Japanese, Korean, Simplified Chinese, and Traditional Chinese. The project is licensed under the MIT License.

Read the focused documentation before changing related behavior:

- [Architecture](docs/architecture.md)
- [Internationalization](docs/i18n.md)
- [Tools](docs/tools.md)

## Agent Workflow

- Act as a manager and agent orchestrator. Delegate implementation work to sub-agents or task agents; do not implement delegated work yourself.
- Break work into small, reviewable tasks and use a PDCA cycle: plan, execute, verify, and adjust.
- Inspect the relevant code and tests before editing. Prefer existing patterns and keep changes narrowly scoped.
- Work safely in a shared repository. Never discard, overwrite, reformat, or revert changes made by other contributors.
- At the end of every task, run `npm run verify` and create a commit containing only the task's changes. If the user explicitly forbids verification or committing, follow that instruction and report the skipped step.

## Architecture

- `src/index.tsx` initializes i18n, global configuration, React, error handling, and service worker registration.
- `src/ui/App.tsx` selects Research Calc or IV Calc from the URL and updates localized metadata and paths.
- `src/ui/ResearchCalc/` contains the simpler Research Calc application. Its persisted state is handled by `ResearchCalcAppConfig.ts`.
- `src/ui/IvCalc/` contains the larger IV Calc application. `IvCalcApp.tsx` coordinates the UI, while `IvState.ts` owns reducer actions, state normalization, and persisted state.
- `src/ui/common/` and `src/ui/Dialog/` contain shared UI. Keep feature-specific components within their feature directory.
- `src/util/` contains calculation and domain logic. Prefer keeping business logic out of React components.
- `src/data/` contains typed accessors and static game data. Large JSON files are application data, so avoid unrelated formatting or reordering.
- Several settings and box contents are persisted in `localStorage`. Preserve storage keys, serialized formats, defaults, and migration behavior unless a change explicitly requires otherwise.

## TypeScript And Editing

- TypeScript is strict in both application and script configurations; `strict` and `noImplicitAny` are enabled.
- Do not introduce `any` to bypass type errors. Use existing domain types, narrow unknown values, and keep reducer action unions exhaustive.
- Follow existing React hooks, reducer, Material UI, and file organization patterns.
- Use Biome for formatting and oxlint for linting. Avoid broad auto-fixes or repository-wide formatting for a localized change.
- Add or update tests with behavioral changes, especially for calculations, normalization, persistence, data validation, and edge cases.

## Internationalization

- Supported language codes are `en`, `ja`, `ko`, `zh-CN`, and `zh-TW`.
- i18next setup and lazy language loading live in `src/i18n.ts`; per-language bundles live under `src/i18n/`.
- Translation namespaces are split by concern, including `common`, `data`, `events`, `IvCalc`, `IvCalcNews`, `pokemons`, `ResearchCalc`, and `skills`.
- Do not hard-code user-facing text when a translation key is appropriate. When adding or changing a key, update all five languages and keep their key structures aligned.
- Preserve UTF-8 text and Pokémon spelling; do not commit mojibake.

## Testing And Verification

- Vitest runs with globals and a jsdom environment.
- Tests use co-located `*.test.ts` files and primarily cover utilities, calculations, reducers, persistence, and data invariants.
- During development, run the narrowest relevant test first, then expand verification based on the change's risk.
- Before completing a task, run the full `npm run verify`, which performs type checking, linting, non-watch tests, and a production build.
- If verification cannot run or fails for an unrelated pre-existing reason, report the exact command and failure without altering unrelated files.

## Commands

- `npm run dev` - Start the Vite development server and open a browser.
- `npm run build` - Create the production build.
- `npm run typecheck` - Type-check application and script TypeScript configurations.
- `npm run lint` - Run oxlint and Biome checks.
- `npm run lint:fix` - Apply oxlint and Biome fixes.
- `npm run fmt` - Format files with Biome.
- `npm test` - Run Vitest in watch mode.
- `npm run test -- run` - Run Vitest once.
- `npm run verify` - Run typecheck, lint, tests, and production build.
