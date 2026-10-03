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
	dirExists,
	getSnapshotDiskFiles,
	readTestDB,
	runCLIForTest,
	seedSnapshot,
	TEST_DIR,
} from "../helpers/index";

describe("delete command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("deletes an entire snapshot and removes its files from disk", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(
			homeDir,
			{
				key: "delete-me",
				type: SnapshotType.Files,
			},
			{
				"file1.txt": "data",
			},
		);

		const result = await runCLIForTest(["-k", "delete-me", "delete"]);
		expect(result.exitCode).toBe(0);

		const db = await readTestDB(homeDir);
		expect(db.find((r) => r.key === "delete-me")).toBeUndefined();

		const snapshotDir = path.join(homeDir, ".bscaff", "delete-me");
		expect(await dirExists(snapshotDir)).toBe(false);
	});

	it("deletes a specific file under a snapshot", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(
			homeDir,
			{
				key: "partial-del",
				type: SnapshotType.Files,
			},
			{
				"keep.txt": "keep this",
				"remove.txt": "remove this",
			},
		);

		const result = await runCLIForTest([
			"-k",
			"partial-del",
			"delete",
			"remove.txt",
		]);

		expect(result.exitCode).toBe(0);

		const remainingFiles = await getSnapshotDiskFiles(homeDir, "partial-del");
		expect(remainingFiles).toContain("keep.txt");
		expect(remainingFiles).not.toContain("remove.txt");
	});

	it("fails when key option is missing", async () => {
		const result = await runCLIForTest(["delete"]);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when attempting to delete an unknown snapshot", async () => {
		const result = await runCLIForTest(["-k", "phantom-snapshot", "delete"]);
		expect(result.exitCode).not.toBe(0);
	});
});
