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

import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupTestDir,
	createFileTree,
	createTestDir,
	runCLIForTest,
	TEST_DIR,
} from "../helpers/index";

describe("template create command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("fails when key option is missing", async () => {
		const sourceDir = path.join(TEST_DIR, "project-dir");
		await createFileTree(sourceDir, {
			"index.js": "console.log('test');",
		});

		const result = await runCLIForTest(["template", "create", sourceDir]);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when source directory does not exist", async () => {
		const nonExistent = path.join(TEST_DIR, "missing-project");
		const result = await runCLIForTest([
			"-k",
			"tmpl-from-dir",
			"template",
			"create",
			nonExistent,
		]);

		expect(result.exitCode).not.toBe(0);
	});
});
