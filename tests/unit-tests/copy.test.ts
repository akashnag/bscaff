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
import { SnapshotType } from "../../src/types/types";
import {
	cleanupTestDir,
	createTestDir,
	runCLIForTest,
	seedSnapshot,
	TEST_DIR,
} from "../helpers/index";

describe("copy command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("fails when key option is missing", async () => {
		const result = await runCLIForTest(["copy"]);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when snapshot key does not exist", async () => {
		const result = await runCLIForTest(["-k", "missing-copy-key", "copy"]);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when relative path specified does not exist in snapshot", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(
			homeDir,
			{
				key: "copy-sample",
				type: SnapshotType.Files,
			},
			{
				"actual.txt": "content",
			},
		);

		const result = await runCLIForTest([
			"-k",
			"copy-sample",
			"copy",
			"does-not-exist.txt",
		]);

		expect(result.exitCode).not.toBe(0);
	});
});
