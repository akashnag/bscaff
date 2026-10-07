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
	setupTestEnvironment,
	TEST_DIR,
	teardownTestEnvironment,
} from "../helpers/data-mgmt.js";

describe("Disk Creation from Clipboard", () => {
	const cm = new ClipboardManager();

	beforeAll(async () => {
		await setupTestEnvironment();
	});

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	/*
	it("Create file on disk from clipboard content", async () => {
		const fileContent = 'export const APP_NAME = "BScaff";';
		const targetFilePath = path.join(TEST_DIR, "constants.ts");

		await cm.copy(fileContent);

		const result = await runCLIForTest(["create", "file", targetFilePath]);

		await cm.copy("");

		expect(result.rawStdout).toContain("File Created Successfully");
		expect(result.exitCode).toBe(0);

		const writtenContent = await fs.readFile(targetFilePath, "utf-8");
		expect(writtenContent).toBe(fileContent);
	});

	it("Create directory tree on disk from ASCII clipboard content", async () => {
		const asciiTree = `
my-app/
├── src/
│   └── main.ts
└── README.md
`;
		const targetTreePath = path.join(TEST_DIR, "scaffolded-app");

		await cm.copy(asciiTree);

		const result = await runCLIForTest([
			"create",
			"tree",
			targetTreePath,
			"-e",
			"overwrite",
		]);

		await cm.copy("");

		expect(result.rawStdout).toContain("Tree Created Successfully");
		expect(result.exitCode).toBe(0);

		const readmeExists = await FileUtils.doesFileExist(
			path.join(targetTreePath, "README.md"),
		);
		const mainExists = await FileUtils.doesFileExist(
			path.join(targetTreePath, "src", "main.ts"),
		);

		expect(readmeExists).toBe(true);
		expect(mainExists).toBe(true);
	});
	*/
});
