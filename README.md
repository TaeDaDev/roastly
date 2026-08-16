# Roastly

AI Roasts. Real Impact. Brutal honesty about your code, said with fire, built to help.

Roastly analyzes your code with Claude and returns a structured roast: a narrative critique, a 0–100 score, and a list of findings with severity, an explanation, a punchy roast line, and a suggested fix.

## Stack

TypeScript · Node · Express · LangChain · Claude (Anthropic) · VS Code Extension API

## Monorepo layout

```text
apps/
  extension/        # VS Code extension
  api/               # Express + LangChain backend
  web/               # roastly.app (not yet built)
packages/
  shared-types/       # RoastResult / Finding Zod schemas, shared across apps
  ui-tokens/           # brand tokens (not yet built)
```

Managed with npm workspaces + Turborepo.

## Setup

```bash
npm install
```

Add to `apps/api/.env`:

```text
ANTHROPIC_API_KEY=your-anthropic-key
API_SECRET=some-random-string
```

`API_SECRET` is a stopgap shared-secret auth scheme (one key for now, not per-user accounts yet — see Roadmap below). Every request to `/roast/code` must include it in an `x-roastly-Key` header.

## Running the API

```bash
cd apps/api
npm run dev      # local dev, tsx watch
npm run build    # compiles to dist/
npm run start    # runs the compiled build (what production uses)
```

Locally starts on `http://localhost:3000`. Also deployed on Railway for the extension to use in practice.

- `GET /health` — health check, no auth required
- `POST /roast/code` — requires `x-roastly-Key` header matching `API_SECRET`. Body: `{ "code": "..." }`, returns a `RoastResult`

## Running the VS Code extension

Open `apps/extension` as its own VS Code workspace folder (File → Open Folder), then press `F5` to launch an Extension Development Host.

First run **Roastly: Set API Key** from the Command Palette and paste in the same value as `API_SECRET` — it's stored via VS Code's `SecretStorage`, not a plain settings file.

Commands (Command Palette, or right-click in the editor):

- **Roastly: Roast File** — roasts the whole active file
- **Roastly: Roast Selection** — roasts just the highlighted text (also in the right-click context menu when text is selected)
- **Roastly: Set API Key** — stores your API key
- **Roastly: Open Roastly Panel** — reveals the sidebar (flame icon in the editor title bar, or the Roastly icon in the Activity Bar)

Running a roast automatically opens the sidebar panel with the score, narrative, and findings, and also adds inline squiggle diagnostics plus "Fix It ⚡" quick actions (lightbulb / `Cmd+.`) for findings with a suggested code fix.

```bash
cd apps/extension
npm run compile   # builds src/ -> out/, needed before F5 picks up changes
npm run test      # runs the automated extension test suite
```

## Current status

- Core pipeline:
 Express → LangChain → Claude, structured output validated against a shared Zod schema
- VS Code extension: roast file/selection, inline diagnostics, Fix It quick actions, sidebar panel, shared-secret auth
- API deployed on Railway

See the project map for the full roadmap (website repo/site roasting, real per-user accounts + roast history, competitor comparison, auto-roast-on-save, CLI).
