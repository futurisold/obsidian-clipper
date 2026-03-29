# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Session orientation

At the start of each session:
1. Read `CHANGELOG.md` — current version, what's done, what's pending, and any failed approaches to avoid repeating.
2. Update `CHANGELOG.md` after every meaningful unit of work (feature, fix, investigation).
3. Record failed approaches explicitly so they aren't re-attempted in future sessions.

## What is this?

A browser extension (Chrome/Firefox/Safari) that clips web content into Obsidian notes. Also ships a programmatic API (`dist/api.mjs`) and a CLI (`dist/cli.cjs`) that share the same core extraction logic via pure functions.

## Commands

```bash
# Development (watch mode)
npm run dev              # Chrome (default)
npm run dev:firefox
npm run dev:safari

# Production builds
npm run build:chrome
npm run build:firefox
npm run build:safari
npm run build            # all three

# CLI / API bundles (esbuild)
npm run build:cli        # → dist/cli.cjs
npm run build:api        # → dist/api.mjs

# Tests
npm test                 # vitest (run once)
npm run test:watch       # watch mode

# Localization
npm run update-locales   # sync translation keys
npm run check-strings    # find unused keys
```

Build output: `dist/` (Chrome), `dist_firefox/`, `dist_safari/`. Production builds also emit zips into `builds/`.

## Build workflow

User develops on **Firefox**. After code changes, always:
1. `rm -rf dist_firefox/`
2. `npm run build:firefox`

Do NOT build Chrome or Safari unless explicitly asked.

## Architecture

Three deployment targets sharing the same core:

```
[Webpage]
    ↓
content.ts          ← injected into page; extracts content, manages highlights
    ↓  (runtime messages)
background.ts       ← service worker; tab lifecycle, highlight mode, YouTube referer rewriting
    ↓  (runtime messages)
core/popup.ts       ← extension popup/side panel; template selection, rendering, save to Obsidian
    ↓
core/settings.ts    ← settings page; vault config, template CRUD, interpreter/LLM config
```

For CLI and library use, `api.ts` is the entry point — it calls the same pure functions without any browser dependencies (`linkedom` replaces the DOM).

## Key abstractions

### Template engine

The template language (`{{variable}}`, `{{var | filter:arg}}`, `{% if %} / {% for %} / {% set %}`) is implemented in three stages:

1. **Parser** (`utils/parser.ts`) — lexes template source into an AST.
2. **Renderer** (`utils/renderer.ts`) — evaluates the AST given a variable map and filter registry.
3. **Compiler** (`utils/template-compiler.ts`) — wraps the renderer; resolves CSS selector variables and LLM prompt variables before rendering.

Filters live in `utils/filters.ts` (registry + simple implementations) and `utils/filters/` (one file per complex filter, 100+ total).

### Content extraction

`utils/content-extractor.ts` drives page extraction:
- Calls **Defuddle** for HTML→Markdown conversion (version pinned in `package.json`).
- Pulls title, author, date, image, favicon via meta tags and **Schema.org** JSON-LD.
- CSS selector variables (`selector:` prefix) run `document.querySelector` in the content script.
- Highlights (text selections and element picks) are serialized as anchor+offset or XPath and injected as `{{highlights}}`.

### Storage & templates

Templates are stored in `chrome.storage.sync` using **LZ-string compression** chunked into ≤8 KB pieces (sync storage limit). See `utils/storage-utils.ts` for the chunk/reassemble logic. Each template carries:
- A Jinja-like body string.
- A list of `Property` objects (typed metadata fields).
- URL trigger patterns (glob and regex) for auto-selection.

### Interpreter (LLM)

`utils/interpreter.ts` handles prompt variables — fields whose value is filled by an LLM call. Supported providers: Anthropic, Azure OpenAI, Hugging Face. The extension enforces a 1-minute rate-limit between calls. Responses must be JSON: `{"prompts_responses": {key: value}}`.

## Multi-target shared logic

`utils/shared.ts` — pure functions with no DOM or browser API dependencies, safe to import from both extension and Node.js (CLI/API).

`api.ts` — programmatic entry point; accepts `{html, url, template, propertyTypes}`, returns `{frontmatter, content, properties, variables}`. Uses `linkedom` for DOM.

When editing extraction or rendering logic, verify the change works in all three contexts (extension, CLI, API).

## TypeScript paths

`tsconfig.json` sets `baseUrl: "src/"` with aliases `managers/*` and `utils/*`. Import these without relative prefixes inside `src/`.
