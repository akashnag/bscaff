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
import { runCLIForTest } from "../helpers/cli-runner.js";
import {
	setupTestEnvironment,
	TEST_DIR,
	teardownTestEnvironment,
} from "../helpers/data-mgmt.js";

describe("Template management", () => {
	let validConfigPath: string;
	let invalidConfigPath: string;
	let templateSourceDir: string;

	beforeAll(async () => {
		await setupTestEnvironment();

		validConfigPath = path.join(TEST_DIR, "valid-template.yaml");
		invalidConfigPath = path.join(TEST_DIR, "invalid-template.yaml");
		templateSourceDir = path.join(TEST_DIR, "template-src");

		const validYaml = `
name: my-app-template
version: 1.0.0
prompts:
  - name: projectName
    type: input
    message: Project Name?
`;
		await fs.writeFile(validConfigPath, validYaml);
		await fs.writeFile(invalidConfigPath, "name: [invalid yaml structure: :");

		await fs.mkdir(templateSourceDir, { recursive: true });
		await fs.writeFile(path.join(templateSourceDir, "bscaff.yaml"), validYaml);
		await fs.writeFile(
			path.join(templateSourceDir, "package.json"),
			'{"name": "{{projectName}}"}',
		);
	});

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	/*
	it("Verify template config file - happy path", async () => {
		const result = await runCLIForTest(["template", "verify", validConfigPath]);

		expect(result.rawStdout).toContain("Template Valid");
		expect(result.exitCode).toBe(0);
	});

	it("Verify template config file - unhappy path", async () => {
		const result = await runCLIForTest([
			"template",
			"verify",
			invalidConfigPath,
		]);

		expect(result.rawStdout).toContain("Validation Error");
		expect(result.exitCode).toBe(1);
	});

	it("Create template from directory", async () => {
		const result = await runCLIForTest([
			"-k",
			"react-template",
			"--desc",
			"React Scaffolding Template",
			"--tags",
			"template,react",
			"template",
			"create",
			templateSourceDir,
		]);

		expect(result.rawStdout).toContain("Template Created!");
		expect(result.rawStdout).toContain("react-template");
		expect(result.exitCode).toBe(0);
	});

	it("Save template from directory with source flag", async () => {
		const result = await runCLIForTest([
			"-k",
			"dir-template",
			"template",
			"save",
			templateSourceDir,
			"--source",
			"dir",
		]);

		expect(result.rawStdout).toContain("Template Saved!");
		expect(result.rawStdout).toContain("dir-template");
		expect(result.exitCode).toBe(0);
	});

	it("List templates by type", async () => {
		const result = await runCLIForTest(["list", "--type", "template"]);

		expect(result.rawStdout).toContain("Found 2 item(s)");
		expect(result.rawStdout).toContain("react-template");
		expect(result.rawStdout).toContain("dir-template");
		expect(result.exitCode).toBe(0);
	});
	*/
});
