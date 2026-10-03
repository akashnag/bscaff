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
	createTestDir,
	executeCLI,
	initLocalGitRepo,
	readTestDB,
	TEST_DIR,
} from "../helpers/index";

describe("save tree command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("saves a directory tree snapshot successfully", async () => {
		const sourceDir = path.join(TEST_DIR, "sample-tree");
		await createFileTree(sourceDir, {
			"README.md": "# Tree Sample",
			"src/index.ts": "console.log('tree');",
			"src/sub/helper.ts": "export const ok = true;",
		});

		const result = await executeCLI(
			["-k", "my-tree", "save", "tree", sourceDir],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "my-tree");
		expect(record).toBeDefined();
		expect(record?.type).toBe("Tree");
		expect(record?.structure).toBeDefined();
		expect(record?.structure?.length).toBeGreaterThanOrEqual(3);
	});

	it("saves a directory tree with description and tags", async () => {
		const sourceDir = path.join(TEST_DIR, "meta-tree");
		await createFileTree(sourceDir, {
			"file.txt": "content",
		});

		const result = await executeCLI(
			[
				"-k",
				"tagged-tree",
				"save",
				"--desc",
				"Scaffolding tree description",
				"--tags",
				"react,typescript",
				"tree",
				sourceDir,
			],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "tagged-tree");
		expect(record?.description).toBe("Scaffolding tree description");
		expect(record?.tags).toEqual(["react", "typescript"]);
	});

	it("saves a git repo tree when --git flag is provided", async () => {
		const gitRepoDir = path.join(TEST_DIR, "git-source");
		await initLocalGitRepo(gitRepoDir, {
			"main.go": "package main\nfunc main() {}\n",
		});

		const result = await executeCLI(
			["-k", "git-tree", "save", "tree", gitRepoDir, "--git"],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "git-tree");
		expect(record).toBeDefined();
		expect(record?.type).toBe("Tree");
	});

	it("fails when key option (-k) is missing", async () => {
		const sourceDir = path.join(TEST_DIR, "tree-no-key");
		await createFileTree(sourceDir, { "test.txt": "data" });

		const result = await executeCLI(["save", "tree", sourceDir], TEST_DIR);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when source directory does not exist", async () => {
		const nonExistent = path.join(TEST_DIR, "non-existent-dir");
		const result = await executeCLI(
			["-k", "fail-tree", "save", "tree", nonExistent],
			TEST_DIR,
		);

		expect(result.exitCode).not.toBe(0);
	});

	it("fails when saving duplicate snapshot key", async () => {
		const sourceDir = path.join(TEST_DIR, "dup-tree");
		await createFileTree(sourceDir, { "data.txt": "123" });

		const first = await executeCLI(
			["-k", "dup-key", "save", "tree", sourceDir],
			TEST_DIR,
		);
		expect(first.exitCode).toBe(0);

		const second = await executeCLI(
			["-k", "dup-key", "save", "tree", sourceDir],
			TEST_DIR,
		);
		expect(second.exitCode).not.toBe(0);
	});
});
