# Roastly

AI Roasts. Real Impact. Brutal honesty about your code, said with fire, built to help.

Roastly analyzes your code with Claude and returns a structured roast: a narrative critique, a 0–100 score, and a list of findings with severity, an explanation, a punchy roast line, and a suggested fix.

## Stack

TypeScript · Node · Express · LangChain · Claude (Anthropic) · VS Code Extension API

## Monorepo layout

```
apps/
  extension/        # VS Code extension (Roastly: Roast File command)
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

Add your Anthropic API key to `apps/api/.env`:

```
ANTHROPIC_API_KEY=your-key-here
```

## Running the API

```bash
cd apps/api
npm run dev
```

Starts an Express server on `http://localhost:3000`.

- `GET /health` — health check
- `POST /roast/code` — body: `{ "code": "..." }`, returns a `RoastResult`

## Running the VS Code extension

Open `apps/extension` as its own VS Code workspace folder (File → Open Folder), then press `F5` to launch an Extension Development Host. With the API running, open any file and run **Roastly: Roast File** from the Command Palette.

```bash
cd apps/extension
npm run test    # runs the automated extension test suite
```

## Current status

MVP (v0.1) complete: single `/roast/code` pipeline (Express → LangChain → Claude, structured output validated against a shared Zod schema) plus a working VS Code command that roasts the active file.

See the project map for the full roadmap (repo/website roasting, inline diagnostics, Fix It quick actions, auth, history).