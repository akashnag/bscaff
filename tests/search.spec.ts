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
import { SnapshotType } from "../src/types/types";
import {
	cleanupTestDir,
	createTestDir,
	executeCLI,
	seedSnapshot,
	stripAnsi,
	TEST_DIR,
} from "./helpers/index";

describe("search command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("searches snapshots by similar key", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(homeDir, {
			key: "react-starter-kit",
			type: SnapshotType.Files,
			description: "React application boilerplate",
		});
		await seedSnapshot(homeDir, {
			key: "vue-starter-kit",
			type: SnapshotType.Files,
			description: "Vue application boilerplate",
		});

		const result = await executeCLI(
			["-k", "react", "search"],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);
		const stdout = stripAnsi(result.stdout);
		expect(stdout).toContain("react-starter-kit");
	});

	it("searches snapshots filtered by type", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await seedSnapshot(homeDir, {
			key: "my-url",
			type: SnapshotType.URL,
			urlContent: "https://example.com",
		});
		await seedSnapshot(homeDir, {
			key: "my-files",
			type: SnapshotType.Files,
		});

		const result = await executeCLI(
			["-k", "my", "search", "--type", "url"],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);
		const stdout = stripAnsi(result.stdout);
		expect(stdout).toContain("my-url");
		expect(stdout).not.toContain("my-files");
	});
});
