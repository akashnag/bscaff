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
	createTestDir,
	executeCLI,
	readTestDB,
	TEST_DIR,
} from "./helpers/index";

describe("save url command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("saves a valid URL bookmark", async () => {
		const targetUrl = "https://github.com/akashnag/bscaff";

		const result = await executeCLI(
			["-k", "bscaff-repo", "save", "url", targetUrl],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "bscaff-repo");
		expect(record).toBeDefined();
		expect(record?.type).toBe("URL");
		expect(record?.urlContent).toBe(targetUrl);
	});

	it("saves a URL with description and tags", async () => {
		const targetUrl = "https://nodejs.org";

		const result = await executeCLI(
			[
				"-k",
				"nodejs-docs",
				"save",
				"--desc",
				"Node.js documentation portal",
				"--tags",
				"nodejs,docs,javascript",
				"url",
				targetUrl,
			],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		const db = await readTestDB(path.join(TEST_DIR, ".home"));
		const record = db.find((r) => r.key === "nodejs-docs");
		expect(record?.description).toBe("Node.js documentation portal");
		expect(record?.tags).toEqual(["nodejs", "docs", "javascript"]);
	});

	it("fails when key option is missing", async () => {
		const result = await executeCLI(
			["save", "url", "https://google.com"],
			TEST_DIR,
		);
		expect(result.exitCode).not.toBe(0);
	});

	it("fails when duplicate key is provided", async () => {
		const first = await executeCLI(
			["-k", "dup-url", "save", "url", "https://one.com"],
			TEST_DIR,
		);
		expect(first.exitCode).toBe(0);

		const second = await executeCLI(
			["-k", "dup-url", "save", "url", "https://two.com"],
			TEST_DIR,
		);
		expect(second.exitCode).not.toBe(0);
	});
});
