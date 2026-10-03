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
	executeCLI,
	readTestDB,
	seedSnapshot,
	TEST_DIR,
} from "../helpers/index";

describe("update commands", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("fails when key flag is missing", async () => {
		const result = await executeCLI(
			["update", "desc", "New description"],
			TEST_DIR,
		);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when updating an unknown snapshot key", async () => {
		const result = await executeCLI(
			["-k", "unknown-key", "update", "desc", "New description"],
			TEST_DIR,
		);
		expect(result.exitCode).not.toBe(0);
	});

	it("updates snapshot key when target key is unique", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(
			homeDir,
			{
				key: "old-key",
				type: SnapshotType.Files,
			},
			{
				"file.txt": "content",
			},
		);

		const result = await executeCLI(
			["-k", "old-key", "update", "key", "new-renamed-key"],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);
		const db = await readTestDB(homeDir);
		expect(db.find((r) => r.key === "new-renamed-key")).toBeDefined();
		expect(db.find((r) => r.key === "old-key")).toBeUndefined();
	});
});
