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
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
} from "vitest";
import pkg from "../../package.json" with { type: "json" };
import { Config } from "../../src/core/config.js";
import { zipDirectory } from "../../src/utils/special-file-io.js";
import { runCLIForTest } from "../helpers/cli-runner.js";
import {
	setupTestEnvironment,
	teardownTestEnvironment,
} from "../helpers/data-mgmt.js";

describe("Template management - working with saved templates", () => {
	let sourceTreeDir: string;
	let extractTargetDir: string;

	let testDir: string;
	let testDirAlternate1: string;
	let testDirAlternate2: string;

	let templateAnswersJSONInputFile: string;

	beforeAll(async () => {
		({ sourceTreeDir, extractTargetDir } = await setupTestEnvironment());
		({ testDir, templateAnswersJSONInputFile } =
			await generateTestTemplate(sourceTreeDir));

		testDirAlternate1 = path.join(sourceTreeDir, "test-temp-template-dir1");
		testDirAlternate2 = path.join(sourceTreeDir, "test-temp-template-dir2");

		const invalidConfigFileAlternate1 = path.join(
			testDirAlternate1,
			"invalid-bscaff.yaml",
		);

		const invalidConfigFileAlternate2 = path.join(
			testDirAlternate2,
			Config.TEMPLATE_CONFIG_FILE,
		);

		await fs.mkdir(testDirAlternate1, { recursive: true });
		await fs.mkdir(testDirAlternate2, { recursive: true });

		const invalidYamlContent = `
_min_bscaff_version: 1.0.0
_exclude: [ unclosed_array
`;

		await fs.writeFile(
			invalidConfigFileAlternate1,
			invalidYamlContent,
			"utf-8",
		);
		await fs.writeFile(
			invalidConfigFileAlternate2,
			invalidYamlContent,
			"utf-8",
		);
	});

	afterAll(async () => {
		//await teardownTestEnvironment();
	});

	it("Verify template config file - happy path", async () => {
		const result = await runCLIForTest(["template", "verify", testDir]);

		expect(result.rawStdout).toContain("Template Verification Passed");
		expect(result.exitCode).toBe(0);
	});

	it("Verify template config file - unhappy path (invalid config)", async () => {
		const result1 = await runCLIForTest([
			"template",
			"verify",
			testDirAlternate1,
		]);

		expect(result1.rawStdout).toContain("Missing Template Configuration File");
		expect(result1.exitCode).not.toBe(0);

		const result2 = await runCLIForTest([
			"template",
			"verify",
			testDirAlternate2,
		]);

		expect(result2.rawStdout).toContain("Template Verification Failed");
		expect(result2.exitCode).not.toBe(0);
	});

	it("Save template from directory", async () => {
		const result = await runCLIForTest([
			"-k",
			"my-template",
			"template",
			"save",
			"--desc",
			"Sample app template",
			"--tags",
			"node,template",
			"--source",
			"dir",
			testDir,
		]);

		expect(result.rawStdout).toContain("Snapshot Saved!");
		expect(result.rawStdout).toContain("my-template");
		expect(result.exitCode).toBe(0);
	});

	it("Ensure template is listed", async () => {
		const result = await runCLIForTest(["list", "--type", "template"]);

		expect(result.rawStdout).toContain("Found 1 item(s)");
		expect(result.rawStdout).toContain("my-template");
		expect(result.rawStdout).toContain("#node #template");
		expect(result.exitCode).toBe(0);
	});

	it("List templates by tag", async () => {
		const result = await runCLIForTest(["list", "--tags", "template"]);

		expect(result.rawStdout).toContain("Found 1 item(s)");
		expect(result.rawStdout).toContain("my-template");
		expect(result.exitCode).toBe(0);
	});

	it("Fetch template details", async () => {
		const result = await runCLIForTest(["-k", "my-template", "list"]);

		expect(result.rawStdout).toContain("Snapshot Details [Template]");
		expect(result.rawStdout).toContain("my-template");
		expect(result.rawStdout).toContain("Sample app template");
		expect(result.exitCode).toBe(0);
	});

	it("Create template directly from directory", async () => {
		const result = await runCLIForTest([
			"-k",
			"created-template",
			"template",
			"create",
			"--desc",
			"Directly created template",
			testDir,
		]);

		expect(result.rawStdout).toContain("Snapshot Saved");
		expect(result.rawStdout).toContain("created-template");
		expect(result.exitCode).toBe(0);
	});

	it("Generate project from saved template", async () => {
		const result = await runCLIForTest([
			"-k",
			"my-template",
			"template",
			"generate-project",
			"--json",
			process.platform.toString() === "win32"
				? `$(gc ${templateAnswersJSONInputFile} -Raw)`
				: `$(cat ${templateAnswersJSONInputFile})`,
			extractTargetDir,
		]);

		expect(result.rawStdout).toContain("Project generated successfully!");
		expect(result.exitCode).toBe(0);

		await validateSuccessfulProjectGeneration(extractTargetDir);
	});

	it("Delete template", async () => {
		const result = await runCLIForTest([
			"-k",
			"my-template",
			"delete",
			"--force",
		]);

		expect(result.rawStdout).toContain("Snapshot Deleted Successfully");
		expect(result.rawStdout).toContain("my-template");
		expect(result.exitCode).toBe(0);
	});
});

describe("Template management - direct project generation", () => {
	let sourceTreeDir: string;
	let extractTargetDir: string;

	let testDir: string;
	let testZip: string;
	let templateAnswersJSONInputFile: string;

	const gitRepoURL: string = "https://";

	beforeEach(async () => {
		({ sourceTreeDir, extractTargetDir } = await setupTestEnvironment());
		({ testDir, templateAnswersJSONInputFile } =
			await generateTestTemplate(sourceTreeDir));
		testZip = path.join(sourceTreeDir, "test-template-zip.zip");
		zipDirectory(testDir, testZip);
	});

	afterEach(async () => {
		await teardownTestEnvironment();
	});

	/*
	it("Generate project directly from git repo", async () => {
		const result = await runCLIForTest([
			// TODO: add args
		]);

		expect(result.rawStdout).toContain("Project generated successfully");
		expect(result.exitCode).toBe(0);
		await validateSuccessfulProjectGeneration(extractTargetDir);
	});*/

	it("Generate project directly from zip file", async () => {
		console.log(testZip);

		const result = await runCLIForTest([
			"template",
			"generate-project",
			"--from-zip",
			testZip,
			"--json",
			process.platform.toString() === "win32"
				? `$(gc ${templateAnswersJSONInputFile} -Raw)`
				: `$(cat ${templateAnswersJSONInputFile})`,
			extractTargetDir,
		]);

		expect(result.rawStdout).toContain("Project generated successfully");
		expect(result.exitCode).toBe(0);
		await validateSuccessfulProjectGeneration(extractTargetDir);
	});

	it("Generate project directly from directory", async () => {
		const result = await runCLIForTest([
			"template",
			"generate-project",
			"--from-dir",
			testDir,
			"--json",
			process.platform.toString() === "win32"
				? `$(gc ${templateAnswersJSONInputFile} -Raw)`
				: `$(cat ${templateAnswersJSONInputFile})`,
			extractTargetDir,
		]);

		expect(result.rawStdout).toContain("Project generated successfully");
		expect(result.exitCode).toBe(0);
		await validateSuccessfulProjectGeneration(extractTargetDir);
	});
});

// ----------------------- [helpers] -------------------------

async function generateTestTemplate(
	sourceTreeDir: string,
): Promise<{ testDir: string; templateAnswersJSONInputFile: string }> {
	const testDir = path.join(sourceTreeDir, "test-temp-template-dir");

	const templateAnswersJSONInputFile = path.join(
		sourceTreeDir,
		"template-inputs.json",
	);
	const validConfigFile = path.join(testDir, Config.TEMPLATE_CONFIG_FILE);

	// Set up fixture directory with nested files, folders, and variable placeholders
	await fs.mkdir(testDir, { recursive: true });

	const validYamlContent = `
_min_bscaff_version: "1.0.0"
_post_generation_message: "Project generated successfully!"
project_name:
  type: str
  prompt: "What is your project name?"
  default: "my-app"
module_name:
  type: str
  prompt: "What is your module name?"
  default: "core"
`;

	await fs.writeFile(validConfigFile, validYamlContent, "utf-8");

	// create json answers file to read non-interactively for project generation
	await fs.writeFile(
		templateAnswersJSONInputFile,
		JSON.stringify({ project_name: "awesome-app", module_name: "auth" }),
		"utf-8",
	);

	// Create root-level templated file
	await fs.writeFile(
		path.join(testDir, "README.md.jinja"),
		"# {{ project_name }}\nModule: {{ module_name }}",
		"utf-8",
	);

	// Create a nested directory with templated folder name and file name
	const nestedDirPath = path.join(testDir, "src", "{{ module_name }}");
	await fs.mkdir(nestedDirPath, { recursive: true });

	await fs.writeFile(
		path.join(nestedDirPath, "{{ module_name }}-service.ts.jinja"),
		"export const {{ module_name }}Service = () => '{{ project_name }}';",
		"utf-8",
	);

	// Create a static non-templated asset file
	await fs.writeFile(
		path.join(testDir, "src", "config.json"),
		'{\n  "version": "1.0.0"\n}',
		"utf-8",
	);

	return { testDir, templateAnswersJSONInputFile };
}

async function validateSuccessfulProjectGeneration(
	extractTargetDir: string,
): Promise<void> {
	// Verify root file variable replacement
	const generatedReadme = await fs.readFile(
		path.join(extractTargetDir, "README.md"),
		"utf-8",
	);
	expect(generatedReadme).toContain("# awesome-app");
	expect(generatedReadme).toContain("Module: auth");

	// Verify directory tree creation with rendered folder name
	const renderedModuleDir = path.join(extractTargetDir, "src", "auth");
	const dirStats = await fs.stat(renderedModuleDir);
	expect(dirStats.isDirectory()).toBe(true);

	// Verify rendered file name and contents inside the dynamic directory
	const renderedFilePath = path.join(renderedModuleDir, "auth-service.ts");
	const generatedService = await fs.readFile(renderedFilePath, "utf-8");
	expect(generatedService).toBe(
		"export const authService = () => 'awesome-app';",
	);

	// Verify static file was copied intact
	const staticConfig = await fs.readFile(
		path.join(extractTargetDir, "src", "config.json"),
		"utf-8",
	);
	expect(JSON.parse(staticConfig)).toEqual({ version: "1.0.0" });
}
