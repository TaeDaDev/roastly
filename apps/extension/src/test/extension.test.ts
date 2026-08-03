import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('roastFile command runs without throwing', async function () {
		this.timeout(20000);
		const doc = await vscode.workspace.openTextDocument({
			content: 'function add(a, b) { return a + b }',
			language: 'javascript',
		});
		await vscode.window.showTextDocument(doc);
		try {
			await vscode.commands.executeCommand('roastly.roastFile');
			console.log('Command completed with no error thrown.');
		} catch (err) {
			console.log('Command threw an error:', err);
			throw err;
		}
	});
});
