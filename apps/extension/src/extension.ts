import * as vscode from "vscode";
// type-only import so this doesn't turn into a require() call at runtime -
// shared-types is an ESM package but this extension is CommonJS, and a real
// (value) import here would blow up with an ERR_REQUIRE_ESM style error.
// resolution-mode is required by nodenext when a CJS file type-imports from ESM.
import type { Finding, RoastResult } from "@roastly/shared-types" with {
  "resolution-mode": "import",
};

// maps our own severity strings (from the Zod schema in shared-types) to
// whatever VS Code's diagnostic squiggles use. we have 4 severities and VS Code
// also has 4, so this is a straight 1:1, but that's a coincidence not a guarantee -
// if the schema ever changes this needs to be revisited.
function severityToVsCode(
  severity: "low" | "medium" | "high" | "critical",
): vscode.DiagnosticSeverity {
  switch (severity) {
    case "low":
      return vscode.DiagnosticSeverity.Hint;
    case "medium":
      return vscode.DiagnosticSeverity.Information;
    case "high":
      return vscode.DiagnosticSeverity.Warning;
    case "critical":
      return vscode.DiagnosticSeverity.Error;
  }
}

// wraps whatever content HTML in a consistent styled shell. using VS Code's
// own theme CSS variables (--vscode-*) instead of hardcoded colors, so this
// automatically matches whatever theme the user has - light, dark, high
// contrast, whatever - rather than looking broken in half of them
function wrapHtml(content: string): string {
  return `
    <html>
      <head>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            padding: 12px;
            line-height: 1.5;
          }
          .empty {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
          }
          .score-row {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }
          .score-circle {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: linear-gradient(135deg, #ff6b35, #f7931e);
            color: white;
            font-weight: 700;
            font-size: 18px;
            flex-shrink: 0;
          }
          .score-label {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
          }
          .roast {
            font-style: italic;
            border-left: 3px solid #ff6b35;
            padding-left: 10px;
            margin-bottom: 16px;
          }
          .findings {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }
          .finding {
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-widget-border, var(--vscode-panel-border));
            border-radius: 6px;
            padding: 10px 12px;
          }
          .finding-header {
            margin-bottom: 6px;
          }
          .badge {
            display: inline-block;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            padding: 2px 8px;
            border-radius: 10px;
          }
          .badge-critical { background: #f14c4c; color: white; }
          .badge-high { background: #ff6b35; color: white; }
          .badge-medium { background: #f7931e; color: white; }
          .badge-low { background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
          .issue {
            margin: 4px 0;
          }
          .roast-line {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
            margin: 4px 0;
          }
          .fix {
            margin: 4px 0;
            font-size: 13px;
          }
          .fix-label {
            font-weight: 700;
            color: #ff6b35;
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `;
}

// the sidebar panel VS Code shows when the Roastly Activity Bar icon (or the
// editor-title flame button) is clicked. resolveWebviewView only fires once,
// the first time VS Code actually creates the view - that's why I stash the
// webviewView on `this.view`, so showRoast() can update it later on demand
// instead of only being able to set the HTML once at creation time
class RoastlyViewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;

  resolveWebviewView(webviewView: vscode.WebviewView) {
    this.view = webviewView;
    // no scripts needed yet - this is just static HTML rendering roast data,
    // not an interactive webview. enabling scripts unnecessarily would be a
    // pointless attack surface for something that doesn't need JS at all
    webviewView.webview.options = { enableScripts: false };
    webviewView.webview.html = wrapHtml(
      `<p class="empty">No roast yet. Run <strong>Roastly: Roast File</strong> to get started.</p>`,
    );
  }

  // called from roastText() every time a roast completes - guard against
  // this running before resolveWebviewView ever fires (e.g. if a roast
  // somehow completed before the user ever opened the panel once)
  showRoast(result: RoastResult) {
    if (!this.view) {
      return;
    }

    const findingsHtml = result.findings
      .map(
        (finding) => `
        <div class="finding severity-${finding.severity}">
          <div class="finding-header">
            <span class="badge badge-${finding.severity}">${finding.severity}</span>
          </div>
          <p class="issue">${finding.issue}</p>
          <p class="roast-line">"${finding.roastLine}"</p>
          <p class="fix"><span class="fix-label">Fix:</span> ${finding.fix}</p>
        </div>
      `,
      )
      .join("");

    this.view.webview.html = wrapHtml(`
      <div class="score-row">
        <div class="score-circle">${result.score}</div>
        <div class="score-label">out of 100</div>
      </div>
      <p class="roast">${result.roast}</p>
      <div class="findings">${findingsHtml}</div>
    `);
  }
}

// turns a finding's line number into a squiggle range for the whole line.
// two gotchas here: finding.line is optional (Claude doesn't always give one,
// falls back to line 0), and VS Code lines are 0-indexed while the line number
// coming back from the API is 1-indexed like a normal human would read it.
// end column is just a big number (1000) as a lazy "underline to end of line" -
// not measuring actual line length, revisit if this ever looks wrong on long lines.
function findingToRange(finding: Finding): vscode.Range {
  const line = finding.line !== undefined ? finding.line - 1 : 0;
  return new vscode.Range(
    new vscode.Position(line, 0),
    new vscode.Position(line, 1000),
  );
}

// vscode.Diagnostic only holds a message + severity, not the full Finding -
// so if I want the CodeActionProvider below to get at fix/codeSuggestion
// later, I need to stash the actual findings somewhere keyed by the file
// they came from. uri.toString() as the key since Uri objects themselves
// aren't reliable as Map keys (reference equality, not value equality)
const findingsByUri = new Map<string, Finding[]>();

// this is what powers the little lightbulb / Cmd+. "Fix It" menu. VS Code
// calls provideCodeActions whenever the cursor/selection is near a
// diagnostic, passing in the range it cares about - I look up whatever
// findings I stored for this file and hand back one quick-fix action per
// finding that both has a codeSuggestion AND overlaps that range
class RoastlyCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
  ): vscode.CodeAction[] {
    const findings = findingsByUri.get(document.uri.toString()) ?? [];

    return findings
      .filter((finding) => {
        const findingRange = findingToRange(finding);
        // careful: findingRange here is NOT the same as the outer `range`
        // param - naming these the same thing once shadowed the outer one
        // and silently broke the filter (always true, comparing to itself)
        return !!finding.codeSuggestion && !!findingRange.intersection(range);
      })
      .map((finding) => {
        const action = new vscode.CodeAction(
          `Quick Roast: ${finding.fix}`,
          vscode.CodeActionKind.QuickFix,
        );
        // the actual "fix" - a WorkspaceEdit that swaps the flagged range
        // for Claude's suggested replacement. this is what runs when the
        // user actually clicks the quick fix, not just displays it
        action.edit = new vscode.WorkspaceEdit();
        action.edit.replace(
          document.uri,
          findingToRange(finding),
          finding.codeSuggestion || "",
        );
        return action;
      });
  }
}

export async function roastText(
  text: string,
  uri: vscode.Uri,
  roastCollection: vscode.DiagnosticCollection,
  apiKey: string,
  viewProvider?: RoastlyViewProvider,
) {
  const { RoastResult } = await import("@roastly/shared-types");
  const response = await fetch(
    "https://roastly-production-2573.up.railway.app/roast/code",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-roastly-Key": apiKey,
      },
      body: JSON.stringify({ code: text }),
    },
  );

  // .parse() both validates the API response at runtime AND gives me a
  // properly typed result - don't trust the network, even though it's my
  // own API right now, this is what stops a shape change on the backend
  // from silently corrupting data on this end
  const result = RoastResult.parse(await response.json());

  vscode.window.showInformationMessage(result.roast);
  findingsByUri.set(uri.toString(), result.findings);
  if (viewProvider) {
    // auto-reveal the sidebar so the user actually sees the result
    // without having to remember to click the flame icon themselves -
    // matches how Claude/Copilot's own panels behave

    await vscode.commands.executeCommand("workbench.view.extension.roastly");

    viewProvider.showRoast(result);
  }

  // turn every finding into a squiggle - this is what actually shows up
  // as inline warnings/errors in the editor gutter, separate from the
  // popup message above which is just the overall roast narrative
  const diagnostics = result.findings.map(
    (finding: Finding) =>
      new vscode.Diagnostic(
        findingToRange(finding),
        finding.issue,
        severityToVsCode(finding.severity),
      ),
  );

  roastCollection.set(uri, diagnostics);
}

// activate() runs once, the first time any of my commands actually gets invoked
// (not on VS Code startup) - that's what activationEvents: [] in package.json means
export function activate(context: vscode.ExtensionContext) {
  console.log('Congratulations, your extension "roastly" is now active!');

  // this collection has to live at this scope (not inside the command callback)
  // so it persists across invocations instead of getting recreated - otherwise
  // I'd lose the ability to clear old squiggles before setting new ones
  const roastCollection =
    vscode.languages.createDiagnosticCollection("roastly");

  const disposable = vscode.commands.registerCommand(
    "roastly.roastFile",
    async () => {
      if (!vscode.window.activeTextEditor) {
        vscode.window.showInformationMessage("No active file to roast!");
        return;
      }

      const code = vscode.window.activeTextEditor.document.getText();

      const apiKey = await context.secrets.get("roastlyApiKey");
      if (!apiKey) {
        vscode.window.showInformationMessage(
          "No Roastly API key set! Use the 'Set API Key' command first.",
        );
        return;
      }
      const editor = vscode.window.activeTextEditor;

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Roastly is roasting your code...",
        },
        async () => {
          await roastText(
            code,
            editor.document.uri,
            roastCollection,
            apiKey,
            roastlyViewProvider,
          );
        },
      );
    },
  );

  // separate command, separate disposable - was accidentally nesting this
  // inside roastFile's registerCommand call as a third arg earlier, which
  // "worked" by accident (JS still evaluates it as an expression) but never
  // got tracked in subscriptions, so it would've leaked on deactivate
  const selectionDisposable = vscode.commands.registerCommand(
    "roastly.roastSelection",
    async () => {
      if (!vscode.window.activeTextEditor) {
        vscode.window.showInformationMessage("No active file to roast!");
        return;
      }

      const selection = vscode.window.activeTextEditor.selection;
      const code = vscode.window.activeTextEditor.document.getText(selection);

      const apiKey = await context.secrets.get("roastlyApiKey");
      if (!apiKey) {
        vscode.window.showInformationMessage(
          "No Roastly API key set! Use the 'Set API Key' command first.",
        );
        return;
      }
      const editor = vscode.window.activeTextEditor;
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Roastly is roasting your code...",
        },
        async () => {
          await roastText(
            code,
            editor.document.uri,
            roastCollection,
            apiKey,
            roastlyViewProvider,
          );
        },
      );
    },
  );

  const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" }, //applies to any file on disk, not just a specific language
    new RoastlyCodeActionProvider(),
    // narrowing to just QuickFix kinds - without this VS Code doesn't know
    // what category these actions fall into for filtering/sorting purposes
    { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
  );

  const setApiKeyDisposable = vscode.commands.registerCommand(
    "roastly.setApiKey",
    async () => {
      const key = await vscode.window.showInputBox({
        prompt: "Enter your Roastly API key",
        password: true,
      });
      if (!key) {
        return;
      }
      await context.secrets.store("roastlyApiKey", key);
      vscode.window.showInformationMessage("Roastly API key saved.");
    },
  );

  // the editor-title flame button - just reveals the sidebar, doesn't roast
  // anything itself. "workbench.view.extension.roastly" is a built-in VS Code
  // command for showing a view container; "roastly" has to match the id I
  // gave the viewsContainers entry in package.json, not the view id itself
  const openPanelDisposable = vscode.commands.registerCommand(
    "roastly.openPanel",
    async () => {
      await vscode.commands.executeCommand("workbench.view.extension.roastly");
    },
  );

  // this exact instance is what needs to get passed into roastText() below -
  // learned the hard way that `new RoastlyViewProvider()` at the call site
  // creates a disconnected, throwaway instance that VS Code never calls
  // resolveWebviewView() on, so its showRoast() would silently no-op forever
  const roastlyViewProvider = new RoastlyViewProvider();
  const viewDisposable = vscode.window.registerWebviewViewProvider(
    "roastly.roastView",
    roastlyViewProvider,
  );

  // pushing into subscriptions means VS Code disposes all seven of these
  // automatically when the extension deactivates - don't need to manually
  // clean up in deactivate() below
  context.subscriptions.push(
    disposable,
    selectionDisposable,
    roastCollection,
    codeActionDisposable,
    setApiKeyDisposable,
    viewDisposable,
    openPanelDisposable,
  );
}

export function deactivate() {}
