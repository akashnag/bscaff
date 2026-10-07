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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCLIForTest } from "../helpers/cli-runner.js";
import {
	setupTestEnvironment,
	teardownTestEnvironment,
} from "../helpers/data-mgmt.js";

describe("Search and Metadata Management", () => {
	beforeAll(async () => {
		await setupTestEnvironment();

		await runCLIForTest([
			"-k",
			"api-docs",
			"save",
			"--desc",
			"Documentation endpoint link",
			"--tags",
			"docs,api",
			"url",
			"https://api.example.com/docs",
		]);
	});

	afterAll(async () => {
		await teardownTestEnvironment();
	});

	it("Search snapshot by description and type filter", async () => {
		const result = await runCLIForTest([
			"search",
			"--desc",
			"Documentation",
			"--type",
			"url",
		]);

		expect(result.rawStdout).toContain("api-docs");
		expect(result.exitCode).toBe(0);
	});

	it("Update snapshot description", async () => {
		const result = await runCLIForTest([
			"-k",
			"api-docs",
			"update",
			"desc",
			"Updated OpenAPI specifications link",
		]);

		expect(result.rawStdout).toContain("Description Updated Successfully");
		expect(result.exitCode).toBe(0);
	});

	/*
	it("Search snapshot by key approximation", async () => {
		const result = await runCLIForTest(["-k", "api", "search"]);

		expect(result.rawStdout).toContain("Found Matches");
		expect(result.rawStdout).toContain("api-docs");
		expect(result.exitCode).toBe(0);
	});

	
	it("Update snapshot key", async () => {
		const result = await runCLIForTest([
			"-k",
			"api-docs",
			"update",
			"key",
			"openapi-docs",
		]);

		expect(result.rawStdout).toContain("Key Updated Successfully");
		expect(result.exitCode).toBe(0);

		const checkOldKey = await runCLIForTest(["-k", "api-docs", "list"]);
		expect(checkOldKey.rawStdout).toContain("Key Not Found");
		expect(checkOldKey.exitCode).toBe(1);

		const checkNewKey = await runCLIForTest(["-k", "openapi-docs", "list"]);
		expect(checkNewKey.rawStdout).toContain(
			"Updated OpenAPI specifications link",
		);
		expect(checkNewKey.exitCode).toBe(0);
	});
	*/
});
