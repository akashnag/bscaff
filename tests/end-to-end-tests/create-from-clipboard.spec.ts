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
import * as FileUtils from "../../src/utils/file-utils.js";
import { runCLIForTest } from "../helpers/cli-runner.js";
import {
	cleanDir,
	doFilesExist,
	setupTestEnvironment,
	TEST_DIR,
	teardownTestEnvironment,
} from "../helpers/data-mgmt.js";

describe("Disk Creation from Clipboard", () => {
	const cm = new ClipboardManager();
	let extractTargetDir: string;

	beforeAll(async () => {
		({ extractTargetDir } = await setupTestEnvironment());
	});

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	it("Create file on disk from clipboard content", async () => {
		cleanDir(extractTargetDir);

		const fileContent = 'export const APP_NAME = "BScaff";';
		const targetFilePath = path.join(extractTargetDir, "constants.ts");

		await cm.copy(fileContent);

		const result = await runCLIForTest(["create", "file", targetFilePath]);

		await cm.copy("");

		expect(result.rawStdout).toContain("File Created Successfully");
		expect(result.exitCode).toBe(0);

		const writtenContent = await fs.readFile(targetFilePath, "utf-8");
		expect(writtenContent).toBe(fileContent);
	});

	it("Create directory tree on disk from ASCII clipboard content", async () => {
		cleanDir(extractTargetDir);

		const asciiTree = `
my-app/
├── src/
│   └── main.ts
└── README.md
`;

		await cm.copy(asciiTree);

		const result = await runCLIForTest([
			"create",
			"tree",
			extractTargetDir,
			"-e",
			"overwrite",
		]);

		await cm.copy("");

		expect(result.rawStdout).toContain("Tree Created Successfully");
		expect(result.exitCode).toBe(0);
		expect(
			doFilesExist(extractTargetDir, [
				"/my-app/README.md",
				"/my-app/src/main.ts",
			]),
		).toBe(true);
	});
});
