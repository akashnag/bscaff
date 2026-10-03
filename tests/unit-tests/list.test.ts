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
	stripAnsi,
	TEST_DIR,
} from "../helpers/index";

describe("list command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("lists snapshots when database contains records", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(homeDir, {
			key: "first-snapshot",
			type: SnapshotType.Files,
			description: "First description",
			tags: ["tag1"],
		});
		await seedSnapshot(homeDir, {
			key: "second-snapshot",
			type: SnapshotType.URL,
			urlContent: "https://example.com",
			tags: ["web"],
		});

		const result = await runCLIForTest(["list"]);
		expect(result.exitCode).toBe(0);

		const stdout = stripAnsi(String(result.stdout));
		expect(stdout).toContain("first-snapshot");
		expect(stdout).toContain("second-snapshot");
	});

	it("filters snapshots by type", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(homeDir, {
			key: "url-one",
			type: SnapshotType.URL,
			urlContent: "https://example.com",
		});
		await seedSnapshot(homeDir, {
			key: "files-one",
			type: SnapshotType.Files,
		});

		const result = await runCLIForTest(["list", "--type", "url"]);
		expect(result.exitCode).toBe(0);

		const stdout = stripAnsi(String(result.stdout));
		expect(stdout).toContain("url-one");
		expect(stdout).not.toContain("files-one");
	});

	it("filters snapshots by tags", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(homeDir, {
			key: "react-app",
			type: SnapshotType.Files,
			tags: ["react", "frontend"],
		});
		await seedSnapshot(homeDir, {
			key: "node-api",
			type: SnapshotType.Files,
			tags: ["backend"],
		});

		const result = await runCLIForTest(["list", "--tags", "react"]);
		expect(result.exitCode).toBe(0);

		const stdout = stripAnsi(String(result.stdout));
		expect(stdout).toContain("react-app");
		expect(stdout).not.toContain("node-api");
	});

	it("lists files within a specific snapshot using -k", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(
			homeDir,
			{
				key: "my-package",
				type: SnapshotType.Files,
			},
			{
				"package.json": "{}",
				"index.js": "module.exports = {};",
			},
		);

		const result = await runCLIForTest(["-k", "my-package", "list"]);
		expect(result.exitCode).toBe(0);

		const stdout = stripAnsi(String(result.stdout));
		expect(stdout).toContain("package.json");
		expect(stdout).toContain("index.js");
	});

	it("fails when listing an unknown snapshot key", async () => {
		const result = await runCLIForTest(["-k", "ghost-key", "list"]);
		expect(result.exitCode).not.toBe(0);
	});
});
