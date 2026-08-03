// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log('Congratulations, your extension "roastly" is now active!');

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  const disposable = vscode.commands.registerCommand(
    "roastly.roastFile",
    async () => {
      // The code you place here will be executed every time your command is executed
      // Display a message box to the user
	  const { RoastResult } = await import("@roastly/shared-types");

      const code =
        vscode.window.activeTextEditor?.document.getText() || "No active file";
      if (!vscode.window.activeTextEditor) {
        vscode.window.showInformationMessage("No active file to roast!");
        return;
      }

      const response = await fetch("http://localhost:3000/roast/code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code }),
      });

      const result = RoastResult.parse(await response.json());
      vscode.window.showInformationMessage(result.roast);
    },
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
