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
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ClipboardManager } from "../../src/core/clipboard.js";
import * as FileUtils from "../../src/utils/file-utils.js";
import { runCLIForTest } from "../helpers/cli-runner.js";
import {
	cleanupTestDir,
	createTestDir,
	TEST_DIR,
} from "../helpers/data-mgmt.js";

describe("Snippet management", () => {
	const cm = new ClipboardManager();
	const RANDOM_TEXT = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla tincidunt enim non porttitor sollicitudin. Ut sed venenatis nunc. Aliquam at velit rhoncus, molestie purus sed, ultrices magna. Donec sagittis nunc ac eleifend vestibulum. Donec sit amet ex ex. Morbi ultricies, elit quis sagittis finibus, nisi felis venenatis eros, eu blandit augue ante accumsan est. Phasellus pharetra, purus in iaculis vulputate, nunc risus mattis risus, eget egestas massa tortor in tellus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Etiam dignissim odio quis lorem cursus, eget ultrices turpis blandit. Donec varius, ipsum at placerat fringilla, ligula magna imperdiet enim, quis eleifend orci diam et diam. Nam bibendum tellus mauris, a pellentesque augue facilisis eget. Maecenas turpis magna, fringilla quis orci condimentum, iaculis malesuada lacus. Interdum et malesuada fames ac ante ipsum primis in faucibus. Proin lobortis viverra lorem ac suscipit. Ut nec accumsan enim.`;
	const RANDOM_CODE = `print("Hello World!")`;

	beforeAll(async () => {
		await createTestDir();
	});

	afterAll(async () => {
		await cleanupTestDir();
	});

	it("Save Snippet from clipboard", async () => {
		await cm.copy(RANDOM_TEXT);

		const result = await runCLIForTest([
			"-k",
			"lorem",
			"save",
			"--tags",
			"latin",
			"snippet",
			"--memory",
		]);

		await cm.copy("");

		expect(result.rawStdout).toContain("Snapshot Saved!");
		expect(result.rawStdout).toContain("lorem"); // Key
		expect(result.rawStdout).toContain("Snippet"); // Type = Snippet
		expect(result.rawStdout).toContain("#latin"); // Tags
		expect(result.exitCode).toBe(0);
	});

	it("Save Snippet from file", async () => {
		FileUtils.writeTextFile(
			FileUtils.formPath([TEST_DIR, "test_file.py"]),
			RANDOM_CODE,
		);

		const result = await runCLIForTest([
			"-k",
			"py-hello-world",
			"save",
			"--tags",
			"python",
			"snippet",
			"./test_file.py",
		]);

		expect(result.rawStdout).toContain("Snapshot Saved!");
		expect(result.rawStdout).toContain("py-hello-world"); // Key
		expect(result.rawStdout).toContain("Snippet"); // Type = Snippet
		expect(result.rawStdout).toContain("#python"); // Tags
		expect(result.exitCode).toBe(0);
	});

	it("Copy Snippet to clipboard", async () => {
		const result1 = await runCLIForTest(["-k", "lorem", "copy"]);
		const content1 = await cm.paste();

		expect(result1.rawStdout).toContain("Copied to Clipboard");
		expect(result1.rawStdout).toContain("lorem");
		expect(content1).toBe(RANDOM_TEXT);
		expect(result1.exitCode).toBe(0);

		const result2 = await runCLIForTest(["-k", "py-hello-world", "copy"]);
		const content2 = await cm.paste();

		await cm.copy("");

		expect(result2.rawStdout).toContain("Copied to Clipboard");
		expect(result2.rawStdout).toContain("py-hello-world");
		expect(content2).toBe(RANDOM_CODE);
		expect(result2.exitCode).toBe(0);
	});

	it("Fetch Snippet details - happy path (before deletion)", async () => {
		const result = await runCLIForTest(["-k", "lorem", "list"]);

		expect(result.rawStdout).toContain("Snapshot Details [Snippet]");
		expect(result.rawStdout).toContain("lorem");
		expect(result.rawStdout).toContain("#latin");
		expect(result.rawStdout).toContain(RANDOM_TEXT.substring(0, 20));
		expect(result.exitCode).toBe(0);
	});

	it("Delete Snippet", async () => {
		const result = await runCLIForTest(["-k", "lorem", "delete", "--force"]);

		expect(result.rawStdout).toContain("Snapshot Deleted Successfully");
		expect(result.rawStdout).toContain("lorem");
		expect(result.exitCode).toBe(0);
	});

	it("Fetch Snippet details - unhappy path (post deletion)", async () => {
		const result = await runCLIForTest(["-k", "lorem", "list"]);

		expect(result.rawStdout).toContain("Key Not Found");
		expect(result.exitCode).toBe(1);
	});
});
