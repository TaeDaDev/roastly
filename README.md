<img src="apps/extension/media/icon.png" alt="Roastly logo" width="96" height="96" />

# Roastly

**AI roasts. Real impact.** Brutal honesty about your code, said with fire, built to help.

I got tired of code review feedback that's either too soft to be useful or too dry to actually read. So I built Roastly: point it at your code, and Claude tears it apart with genuine wit — then hands you the actual fix. The roast gets your attention; the fix makes you better.

Right now Roastly lives as a **VS Code extension**. A website version (roast a GitHub repo or a live URL from your browser) is on the roadmap.

## What it actually does

Run a roast on a file or selection and you get back:

- **A score** (0–100) — how bad is it, really
- **A narrative roast** — the top-level, funny-but-fair verdict on your code
- **Findings** — one per issue, each with a severity, a plain explanation of what's wrong, a punchy one-liner roast, and a concrete fix

That data shows up three ways at once: a **sidebar panel** with the full roast and score, **inline squiggles** under the exact lines with problems, and a **"Fix It ⚡" quick action** (the lightbulb, or `Cmd+.`) that applies Claude's suggested fix with one click.

## Try it

Roastly doesn't have per-user accounts yet (see [Where this is headed](#where-this-is-headed)), so there's no hosted API you can just point at — you'll run your own backend. It only takes a few minutes and you'll need an [Anthropic API key](https://console.anthropic.com/).

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Set up and start the backend:

   ```bash
   cd apps/api
   cp .env.example .env   # fill in ANTHROPIC_API_KEY, and pick any string for API_SECRET
   npm run dev
   ```

   This starts on `http://localhost:3000`. Leave it running.

3. Point the extension at your local backend — swap the URL in `apps/extension/src/extension.ts`'s `fetch` call to `http://localhost:3000/roast/code`, then compile:

   ```bash
   cd apps/extension
   npm run compile
   ```

4. Open `apps/extension` as its own folder in VS Code (File → Open Folder — not the whole monorepo), then press `F5`. This launches a second "Extension Development Host" window with Roastly loaded.

5. In that new window, open the Command Palette (`Cmd+Shift+P`) and run **Roastly: Set API Key**. Paste in the same value you used for `API_SECRET`.

6. Open any code file, then run **Roastly: Roast File** (or select some code and run **Roastly: Roast Selection**, or right-click). Watch the sidebar light up.

## All the commands

Available from the Command Palette, or by right-clicking in the editor:

| Command | What it does |
| --- | --- |
| `Roastly: Roast File` | Roasts the whole active file |
| `Roastly: Roast Selection` | Roasts just the highlighted code |
| `Roastly: Set API Key` | Saves your API key (via VS Code's secure `SecretStorage`, never a plain file) |
| `Roastly: Open Roastly Panel` | Opens the sidebar — also reachable via the flame icon in the editor's title bar, or the Roastly icon in the Activity Bar |

## The API

- `GET /health` — health check, no auth needed
- `POST /roast/code` — the real endpoint. Requires an `x-roastly-Key` header matching your `API_SECRET`. Body: `{ "code": "..." }`. Returns the score/roast/findings shape described above.

## How it's built

```text
apps/
  extension/     VS Code extension — this is what you're actually running
  api/           Express + LangChain backend, talks to Claude
  web/           roastly.app — not built yet
packages/
  shared-types/  RoastResult / Finding shape (Zod schemas), shared by extension + api
  ui-tokens/     brand colors/type — not built yet
```

It's a monorepo (npm workspaces + Turborepo), TypeScript everywhere, LangChain wired to Claude with structured output so the response is always validated against a real schema — no fragile prompt-and-pray JSON parsing.

## Where this is headed

Done: the core roast pipeline, right-click/selection roasting, inline diagnostics, one-click fixes, the sidebar, auth (shared-secret for now), and it's live on Railway.

Not done yet: the website (roast a GitHub repo or a live URL from your browser), real per-user accounts with roast history instead of one shared key, a "roast a competitor" comparison, auto-roast-on-save, and a CLI companion. All of it's on the list — one roast at a time.
