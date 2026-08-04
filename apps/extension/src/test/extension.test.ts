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

	// added this after burning a while trying to debug "nothing happens" in the
	// GUI - turned out to be a stale compile + wrong debug window, not a real
	// bug. this runs the actual command end to end (needs the API running on
	// localhost:3000) and gets a real pass/fail in the terminal instead of me
	// squinting at a notification toast that may or may not have popped up
	test('roastFile command runs without throwing', async function () {
		// default mocha timeout is too short for a real network call to Claude
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
