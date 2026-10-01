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

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupTestDir,
	createFileTree,
	createMockClipboard,
	createTestDir,
	executeCLI,
	readTestDB,
	SAMPLE_SNIPPETS,
	TEST_DIR,
} from "./helpers/index";

describe("save snippet command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("saves a code snippet from a file", async () => {
		const snippetFile = path.join(TEST_DIR, "add.ts");
		await createFileTree(TEST_DIR, {
			"add.ts": SAMPLE_SNIPPETS.TYPESCRIPT,
		});

		const result = await executeCLI(
			["-k", "snippet-add", "save", "snippet", snippetFile],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "snippet-add");
		expect(record).toBeDefined();
		expect(record?.type).toBe("Snippet");
		expect(record?.fileName).toBeDefined();
	});

	it("saves a snippet with description and tags", async () => {
		const snippetFile = path.join(TEST_DIR, "script.sh");
		await createFileTree(TEST_DIR, {
			"script.sh": SAMPLE_SNIPPETS.SHELL,
		});

		const result = await executeCLI(
			[
				"-k",
				"shell-script",
				"save",
				"--desc",
				"Useful bash greeting",
				"--tags",
				"bash,shell",
				"snippet",
				snippetFile,
			],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "shell-script");
		expect(record?.description).toBe("Useful bash greeting");
		expect(record?.tags).toEqual(["bash", "shell"]);
	});

	it("fails when snippet file does not exist", async () => {
		const nonExistent = path.join(TEST_DIR, "missing.py");
		const result = await executeCLI(
			["-k", "missing-snippet", "save", "snippet", nonExistent],
			TEST_DIR,
		);

		expect(result.exitCode).not.toBe(0);
	});

	it("fails when key option is omitted", async () => {
		const file = path.join(TEST_DIR, "code.py");
		await createFileTree(TEST_DIR, { "code.py": SAMPLE_SNIPPETS.PYTHON });

		const result = await executeCLI(["save", "snippet", file], TEST_DIR);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when saving duplicate snippet key", async () => {
		const file = path.join(TEST_DIR, "code.ts");
		await createFileTree(TEST_DIR, { "code.ts": SAMPLE_SNIPPETS.TYPESCRIPT });

		const first = await executeCLI(
			["-k", "dup-snip", "save", "snippet", file],
			TEST_DIR,
		);
		expect(first.exitCode).toBe(0);

		const second = await executeCLI(
			["-k", "dup-snip", "save", "snippet", file],
			TEST_DIR,
		);
		expect(second.exitCode).not.toBe(0);
	});
});
