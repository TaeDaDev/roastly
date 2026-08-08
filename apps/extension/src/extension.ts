import * as vscode from "vscode";
// type-only import so this doesn't turn into a require() call at runtime -
// shared-types is an ESM package but this extension is CommonJS, and a real
// (value) import here would blow up with an ERR_REQUIRE_ESM style error.
// resolution-mode is required by nodenext when a CJS file type-imports from ESM.
import type { Finding } from "@roastly/shared-types" with { "resolution-mode": "import" };

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


export async function roastText(text: string, uri: vscode.Uri, roastCollection: vscode.DiagnosticCollection, apiKey: string) {
  const { RoastResult } = await import("@roastly/shared-types");
  const response = await fetch("http://localhost:3000/roast/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-roastly-Key": apiKey,
        },
        body: JSON.stringify({ code: text }),
      });

      // .parse() both validates the API response at runtime AND gives me a
      // properly typed result - don't trust the network, even though it's my
      // own API right now, this is what stops a shape change on the backend
      // from silently corrupting data on this end
      const result = RoastResult.parse(await response.json());
      vscode.window.showInformationMessage(result.roast);
      findingsByUri.set(uri.toString(), result.findings);

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

      roastCollection.set(
        uri,
        diagnostics,
      );
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

      // hardcoded to localhost for now since I'm still running the API locally -
      // this needs to point at a real deployed URL before this ever ships to
      // anyone else, plus some kind of auth so randoms can't hit my Claude bill
      const apiKey = await context.secrets.get("roastlyApiKey");
      if (!apiKey) {
        vscode.window.showInformationMessage("No Roastly API key set! Use the 'Set API Key' command first.");
        return;
      }
      await roastText(code, vscode.window.activeTextEditor.document.uri, roastCollection, apiKey);
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
        vscode.window.showInformationMessage("No Roastly API key set! Use the 'Set API Key' command first.");
        return;
      }
      await roastText(code, vscode.window.activeTextEditor.document.uri, roastCollection, apiKey);
    },
  );

  const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
    { scheme: "file" }, //applies to any file on disk, not just a specific language
    new RoastlyCodeActionProvider(),
    // narrowing to just QuickFix kinds - without this VS Code doesn't know
    // what category these actions fall into for filtering/sorting purposes
    {providedCodeActionKinds: [vscode.CodeActionKind.QuickFix]}
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


  // pushing into subscriptions means VS Code disposes all five of these
  // automatically when the extension deactivates - don't need to manually
  // clean up in deactivate() below
  context.subscriptions.push(disposable, selectionDisposable, roastCollection, codeActionDisposable, setApiKeyDisposable);
}

export function deactivate() {}