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
import { runCLIForTest } from "../helpers/cli-runner.js";
import { cleanupTestDir, createTestDir } from "../helpers/data-mgmt.js";

describe("URL management", () => {
	const cm = new ClipboardManager();

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
			"--tags",
			"dev,git",
			"url",
			"https://github.com/",
		]);

		expect(result.rawStdout).toContain("Snapshot Saved!");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("https://github.com/");
		expect(result.exitCode).toBe(0);
	});

	it("Ensure URL is listed", async () => {
		const result = await runCLIForTest(["list", "--type", "url"]);

		expect(result.rawStdout).toContain("Found 1 item(s)");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("#dev #git");
		expect(result.rawStdout).toContain("https://github.com/");
		expect(result.exitCode).toBe(0);
	});

	it("List URLs by tag - happy path", async () => {
		const result = await runCLIForTest(["list", "--tags", "dev"]);

		expect(result.rawStdout).toContain("Found 1 item(s)");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("#dev #git");
		expect(result.exitCode).toBe(0);
	});

	it("List URLs by tag - unhappy path (wrong tags)", async () => {
		const result = await runCLIForTest([
			"list",
			"--tags",
			"xyz",
			"--type",
			"url",
		]);

		expect(result.rawStdout).toContain("No items found");
		expect(result.exitCode).toBe(0);
	});

	it("Fetch URL details - unhappy path (wrong key)", async () => {
		const result = await runCLIForTest(["-k", "git-hub", "list"]);

		expect(result.rawStdout).toContain("Key Not Found");
		expect(result.exitCode).toBe(1);
	});

	it("Fetch URL details - before tag update", async () => {
		const result = await runCLIForTest(["-k", "github", "list"]);

		expect(result.rawStdout).toContain("Snapshot Details [URL]");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("#dev #git");
		expect(result.rawStdout).toContain("https://github.com/");
		expect(result.exitCode).toBe(0);
	});

	it("Update URL", async () => {
		const result = await runCLIForTest([
			"-k",
			"github",
			"update",
			"url",
			"https://test.com/",
		]);

		expect(result.rawStdout).toContain("URL Updated Successfully!");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("https://test.com/");
		expect(result.exitCode).toBe(0);
	});

	it("Update URL tags", async () => {
		const result = await runCLIForTest([
			"-k",
			"github",
			"update",
			"tags",
			"swdev,git",
		]);

		expect(result.rawStdout).toContain("Tags Updated Successfully!");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("#swdev #git");
		expect(result.exitCode).toBe(0);
	});

	it("Fetch URL details - after URL + tag update", async () => {
		const result = await runCLIForTest(["-k", "github", "list"]);

		expect(result.rawStdout).toContain("Snapshot Details [URL]");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("#swdev #git");
		expect(result.rawStdout).toContain("https://test.com/");
		expect(result.exitCode).toBe(0);
	});

	it("Copy URL to Clipboard", async () => {
		await cm.copy("");

		const result = await runCLIForTest(["-k", "github", "copy"]);
		const copiedContent = await cm.paste();

		expect(result.rawStdout).toContain("Copied to Clipboard");
		expect(result.rawStdout).toContain("github");
		expect(result.rawStdout).toContain("https://test.com/");
		expect(copiedContent).toBe("https://test.com/");
		expect(result.exitCode).toBe(0);
	});

	it("Delete URL", async () => {
		const result = await runCLIForTest(["-k", "github", "delete", "--force"]);

		expect(result.rawStdout).toContain("Snapshot Deleted Successfully");
		expect(result.rawStdout).toContain("github");
		expect(result.exitCode).toBe(0);
	});
});
