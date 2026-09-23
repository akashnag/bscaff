import * as fs from "node:fs/promises";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	cleanupTestDir,
	createTestDir,
	executeCLI,
	TEST_DIR,
} from "./helpers/cli";

describe("TODO: add description of test feature", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("TODO: add description of test variant", async () => {
		const result = await executeCLI(
			[
				/* command line args */
			],
			TEST_DIR,
		);

		expect(result.exitCode).toBe(0);

		// TODO: add assertion
		//expect(variable).toBe(value);
	});

	// more it() blocks for each test variant (i.e. same feature, different flags)
});
