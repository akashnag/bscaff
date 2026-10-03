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
	readTestDB,
	TEST_DIR,
} from "../helpers/index";

describe("save files command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("saves a single file successfully", async () => {
		const filePath = path.join(TEST_DIR, "config.json");
		await createFileTree(TEST_DIR, {
			"config.json": '{"port": 8080}',
		});

		const result = await executeCLI(
			["-k", "app-config", "save", "files", filePath],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "app-config");
		expect(record).toBeDefined();
		expect(record?.type).toBe("Files");
		expect(record?.structure?.length).toBe(1);
	});

	it("saves multiple files under one snapshot", async () => {
		const file1 = path.join(TEST_DIR, "file1.txt");
		const file2 = path.join(TEST_DIR, "file2.txt");
		await createFileTree(TEST_DIR, {
			"file1.txt": "First content",
			"file2.txt": "Second content",
		});

		const result = await executeCLI(
			[
				"-k",
				"bundle",
				"save",
				"--desc",
				"Two files bundle",
				"--tags",
				"docs,text",
				"files",
				file1,
				file2,
			],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "bundle");
		expect(record?.description).toBe("Two files bundle");
		expect(record?.tags).toEqual(["docs", "text"]);
		expect(record?.structure?.length).toBe(2);
	});

	it("fails when key option is missing", async () => {
		const file = path.join(TEST_DIR, "test.txt");
		await createFileTree(TEST_DIR, { "test.txt": "abc" });

		const result = await executeCLI(["save", "files", file], TEST_DIR);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when one of the specified files does not exist", async () => {
		const file1 = path.join(TEST_DIR, "exists.txt");
		const file2 = path.join(TEST_DIR, "missing.txt");
		await createFileTree(TEST_DIR, { "exists.txt": "ok" });

		const result = await executeCLI(
			["-k", "bad-files", "save", "files", file1, file2],
			TEST_DIR,
		);

		expect(result.exitCode).not.toBe(0);
	});

	it("fails when saving duplicate files snapshot key", async () => {
		const file = path.join(TEST_DIR, "unique.txt");
		await createFileTree(TEST_DIR, { "unique.txt": "data" });

		const first = await executeCLI(
			["-k", "dup-files", "save", "files", file],
			TEST_DIR,
		);
		expect(first.exitCode).toBe(0);

		const second = await executeCLI(
			["-k", "dup-files", "save", "files", file],
			TEST_DIR,
		);
		expect(second.exitCode).not.toBe(0);
	});
});
