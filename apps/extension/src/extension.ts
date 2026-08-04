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

export async function roastText(text: string, uri: vscode.Uri, roastCollection: vscode.DiagnosticCollection) {
  const { RoastResult } = await import("@roastly/shared-types");
  const response = await fetch("http://localhost:3000/roast/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: text }),
      });

      // .parse() both validates the API response at runtime AND gives me a
      // properly typed result - don't trust the network, even though it's my
      // own API right now, this is what stops a shape change on the backend
      // from silently corrupting data on this end
      const result = RoastResult.parse(await response.json());
      vscode.window.showInformationMessage(result.roast);

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
      // dynamic import (not a static one) for the same CJS/ESM reason as the
      // type import up top, except this time we actually need the runtime value
      // (the Zod schema), not just the type, so a type-only import won't cut it
      const { RoastResult } = await import("@roastly/shared-types");

      if (!vscode.window.activeTextEditor) {
        vscode.window.showInformationMessage("No active file to roast!");
        return;
      }

      const code = vscode.window.activeTextEditor.document.getText();

      // hardcoded to localhost for now since I'm still running the API locally -
      // this needs to point at a real deployed URL before this ever ships to
      // anyone else, plus some kind of auth so randoms can't hit my Claude bill
      
    },
  );

  // pushing into subscriptions means VS Code disposes both of these
  // automatically when the extension deactivates - don't need to manually
  // clean up in deactivate() below
  context.subscriptions.push(disposable, roastCollection);
}

export function deactivate() {}