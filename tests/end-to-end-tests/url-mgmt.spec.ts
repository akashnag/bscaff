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
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import {
	cleanupTestDir,
	createTestDir,
	runCLIForTest,
	TEST_DIR,
} from "../helpers/cli";

describe("URL management", () => {
	beforeAll(async () => {
		await createTestDir();
	});

	afterAll(async () => {
		await cleanupTestDir();
	});

	it("Save URL", async () => {
		const result = await runCLIForTest([
			"-k",
			"github",
			"save",
			"url",
			"https://github.com/",
		]);

		expect(result.exitCode).toBe(0);
		expect(result.rawStdout).toContain("Snapshot saved!");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("https://github.com/");
	});
});
