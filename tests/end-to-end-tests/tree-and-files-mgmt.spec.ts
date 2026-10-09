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
import { Config } from "../../src/core/config.js";
import * as FileUtils from "../../src/utils/file-utils.js";
import { runCLIForTest } from "../helpers/cli-runner.js";
import {
	cleanDir,
	doFilesExist,
	doNoneOfTheFilesExist,
	setupTestEnvironment,
	TEST_DB_FILE,
	TEST_DIR,
	TEST_HOME_DIR,
	TEST_HOME_DIR_NAME,
	teardownTestEnvironment,
} from "../helpers/data-mgmt.js";

describe("Tree and Files management", () => {
	const cm = new ClipboardManager();
	let sourceTreeDir: string;
	let sourceFilesDir: string;
	let extractTargetDir: string;

	beforeAll(async () => {
		({ sourceTreeDir, sourceFilesDir, extractTargetDir } =
			await setupTestEnvironment());
	});

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	it("Save directory tree", async () => {
		const result = await runCLIForTest([
			"-k",
			"react-tree",
			"save",
			"--desc",
			"Sample react tree structure",
			"--tags",
			"react,structure",
			"tree",
			sourceTreeDir,
		]);

		expect(result.rawStdout).toContain("Snapshot Saved!");
		expect(result.rawStdout).toContain("react-tree");
		expect(result.exitCode).toBe(0);
	});

	it("Save individual files", async () => {
		const file1 = path.join(sourceFilesDir, "config.json");
		const file2 = path.join(sourceFilesDir, "logger.ts");

		const result = await runCLIForTest([
			"-k",
			"utils-files",
			"save",
			"--desc",
			"Utility configuration files",
			"--tags",
			"utils,config",
			"files",
			file1,
			file2,
		]);

		expect(result.rawStdout).toContain("Snapshot Saved!");
		expect(result.rawStdout).toContain("utils-files");
		expect(result.exitCode).toBe(0);
	});

	it("List tree contents with relative path filter", async () => {
		const result = await runCLIForTest(["-k", "react-tree", "list", "src"]);

		expect(result.rawStdout).not.toContain("README.md");
		expect(result.rawStdout).toContain("src/");
		expect(result.rawStdout).toContain("index.ts");
		expect(result.exitCode).toBe(0);
	});

	it("Copy directory tree structure as ASCII art to clipboard", async () => {
		const result = await runCLIForTest([
			"-k",
			"react-tree",
			"copy",
			"--as-tree",
		]);
		const content = await cm.paste();

		expect(result.rawStdout).toContain("Copied to Clipboard");
		expect(content).toContain("README.md");
		expect(content).toContain("src");
		expect(content).toContain("index.ts");
		expect(result.exitCode).toBe(0);
	});

	it("Copy partial directory tree structure as ASCII art to clipboard", async () => {
		const result = await runCLIForTest([
			"-k",
			"react-tree",
			"copy",
			"src",
			"--as-tree",
		]);
		const content = await cm.paste();

		expect(result.rawStdout).toContain("Copied to Clipboard");
		expect(content).not.toContain("README.md");
		expect(content).toContain("index.ts");
		expect(result.exitCode).toBe(0);
	});

	it("Extract full tree snapshot to target path", async () => {
		cleanDir(extractTargetDir);

		FileUtils.copyDirectory(
			FileUtils.formPath([TEST_HOME_DIR, Config.DIRECTORY_NAME]),
			"/home/akash/",
		);

		const result = await runCLIForTest([
			"-k",
			"react-tree",
			"extract",
			extractTargetDir,
			"-e",
			"overwrite",
		]);

		expect(result.rawStdout).toContain("Extracted Successfully");
		expect(result.exitCode).toBe(0);

		expect(doFilesExist(extractTargetDir, ["/README.md", "src/index.ts"])).toBe(
			true,
		);
	});

	it("Extract tree snapshot partially using --partial flag", async () => {
		cleanDir(extractTargetDir);

		const result = await runCLIForTest([
			"-k",
			"react-tree",
			"extract",
			extractTargetDir,
			"--partial",
			"src",
		]);

		expect(result.rawStdout).toContain("Extracted Successfully");
		expect(result.exitCode).toBe(0);

		expect(doFilesExist(extractTargetDir, ["src/index.ts"])).toBe(true);
		expect(doNoneOfTheFilesExist(extractTargetDir, ["/README.md"])).toBe(true);
	});

	it("Delete specific file inside saved tree snapshot", async () => {
		const result = await runCLIForTest([
			"-k",
			"react-tree",
			"delete",
			"src/index.ts",
			"--force",
		]);

		expect(result.rawStdout).toContain("Deleted Successfully");
		expect(result.exitCode).toBe(0);

		const listResult = await runCLIForTest(["-k", "react-tree", "list"]);
		expect(listResult.rawStdout).toContain("README.md");
		expect(listResult.rawStdout).not.toContain("index.ts");
		expect(result.exitCode).toBe(0);
	});
});
