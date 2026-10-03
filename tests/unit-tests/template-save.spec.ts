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
import {
	cleanupTestDir,
	createSampleTemplateFixture,
	createTemplateZip,
	createTestDir,
	executeCLI,
	initLocalGitRepo,
	readTestDB,
	TEST_DIR,
} from "../helpers/index";

describe("template save command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("saves a template from a local directory", async () => {
		const templateDir = path.join(TEST_DIR, "source-template");
		await createSampleTemplateFixture(templateDir, {
			minVersion: "0.0.1",
		});

		const result = await executeCLI(
			[
				"-k",
				"my-dir-template",
				"template",
				"save",
				templateDir,
				"--source",
				"dir",
			],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "my-dir-template");
		expect(record).toBeDefined();
		expect(record?.type).toBe("Template");
	});

	it("saves a template from a zip archive", async () => {
		const templateDir = path.join(TEST_DIR, "zip-template-src");
		await createSampleTemplateFixture(templateDir);

		const zipPath = path.join(TEST_DIR, "packaged-template.zip");
		await createTemplateZip(templateDir, zipPath, "tmpl-root");

		const result = await executeCLI(
			["-k", "my-zip-template", "template", "save", zipPath, "--source", "zip"],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "my-zip-template");
		expect(record).toBeDefined();
		expect(record?.type).toBe("Template");
	});

	it("saves a template from a local Git repository", async () => {
		const gitDir = path.join(TEST_DIR, "git-template-src");
		await createSampleTemplateFixture(gitDir);
		await initLocalGitRepo(gitDir);

		const result = await executeCLI(
			["-k", "my-git-template", "template", "save", gitDir, "--source", "git"],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "my-git-template");
		expect(record).toBeDefined();
		expect(record?.type).toBe("Template");
	});

	it("fails when key option is missing", async () => {
		const templateDir = path.join(TEST_DIR, "unkeyed-template");
		await createSampleTemplateFixture(templateDir);

		const result = await executeCLI(
			["template", "save", templateDir],
			TEST_DIR,
		);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when directory does not contain bscaff-template.yml", async () => {
		const invalidDir = path.join(TEST_DIR, "empty-template");
		const result = await executeCLI(
			["-k", "bad-template", "template", "save", invalidDir],
			TEST_DIR,
		);

		expect(result.exitCode).not.toBe(0);
	});
});
