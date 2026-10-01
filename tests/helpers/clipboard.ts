/*
 * Copyright (C) 2026 Akash Nag
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 2 as
 * published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { ClipboardManager } from "../../src/core/clipboard.js";

/**
 * Controller returned by `createMockClipboard` allowing test suites to inspect
 * and control simulated clipboard content without executing system clipboard binaries.
 */
export interface MockClipboardController {
	/** Get currently stored clipboard text */
	getContent(): string;
	/** Set currently stored clipboard text */
	setContent(text: string): void;
	/** Install monkey patches on ClipboardManager. Returns a teardown function */
	install(): () => void;
}

/**
 * Creates an in-memory mock for ClipboardManager.
 *
 * Essential for testing commands that use clipboard in headless CI environments:
 * - `bscaff save tree` (from clipboard)
 * - `bscaff save snippet --memory`
 * - `bscaff save url` (from clipboard)
 * - `bscaff copy`
 * - `bscaff create tree`
 * - `bscaff create file`
 *
 * @param initialContent - Optional initial clipboard string
 * @returns MockClipboardController
 */
export function createMockClipboard(
	initialContent = "",
): MockClipboardController {
	let clipboardContent = initialContent;
	const originalCopy = ClipboardManager.prototype.copy;
	const originalPaste = ClipboardManager.prototype.paste;

	return {
		getContent: () => clipboardContent,
		setContent: (text: string) => {
			clipboardContent = text;
		},
		install: () => {
			ClipboardManager.prototype.copy = async (text: string): Promise<void> => {
				clipboardContent = text;
			};
			ClipboardManager.prototype.paste = async (): Promise<string> => {
				return clipboardContent;
			};

			return () => {
				ClipboardManager.prototype.copy = originalCopy;
				ClipboardManager.prototype.paste = originalPaste;
			};
		},
	};
}

/**
 * Valid and invalid ASCII art tree fixtures for testing `bscaff create tree` and `bscaff save tree`.
 */
export const SAMPLE_ASCII_TREES = {
	BASIC: `my-app/
├── src/
│   ├── index.ts
│   └── utils.ts
├── package.json
└── README.md`,

	WITH_PARAMETERS: `{{ project_name }}/
├── src/
│   └── {{ entry_file }}.ts
├── config.json
└── README.md`,

	NESTED: `scaffold/
├── backend/
│   ├── api/
│   │   └── server.go
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   └── App.tsx
│   └── package.json
└── README.md`,

	INVALID: `This is plain text and does not follow any ASCII tree branch format.`,
};

/**
 * Sample code snippets for testing `save snippet`, `update content`, and `copy`.
 */
export const SAMPLE_SNIPPETS = {
	TYPESCRIPT: `export function add(a: number, b: number): number {\n\treturn a + b;\n}\n`,
	PYTHON: `def add(a: int, b: int) -> int:\n    return a + b\n`,
	SHELL: `#!/usr/bin/env bash\necho "Hello from bscaff!"\n`,
};
