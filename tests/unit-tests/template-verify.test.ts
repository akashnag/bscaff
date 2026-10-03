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
	createFileTree,
	createSampleTemplateFixture,
	createTestDir,
	runCLIForTest,
	TEST_DIR,
} from "../helpers/index";

describe("template verify command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("verifies a syntactically valid template config file", async () => {
		const templateDir = path.join(TEST_DIR, "valid-template");
		const fixture = await createSampleTemplateFixture(templateDir, {
			minVersion: "0.0.1",
			questions: {
				app_name: {
					type: "str",
					prompt: "Application Name",
					default: "demo",
				},
			},
		});

		const result = await runCLIForTest([
			"template",
			"verify",
			fixture.configFile,
		]);

		expect(result.exitCode).toBe(0);
	});

	it("fails verification when template config file does not exist", async () => {
		const missingConfig = path.join(TEST_DIR, "does-not-exist.yml");
		const result = await runCLIForTest(["template", "verify", missingConfig]);

		expect(result.exitCode).not.toBe(0);
	});

	it("fails verification when YAML file is malformed", async () => {
		const badConfig = path.join(TEST_DIR, "corrupt-template.yml");
		await createFileTree(TEST_DIR, {
			"corrupt-template.yml": "invalid: [yaml: broken",
		});

		const result = await runCLIForTest(["template", "verify", badConfig]);

		expect(result.exitCode).not.toBe(0);
	});
});
