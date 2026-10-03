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
	fileExists,
	readTestSettings,
	TEST_DIR,
	writeTestSettings,
} from "../helpers/index";

describe("settings command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	it("initializes settings file in storage directory if not already created", async () => {
		const homeDir = path.join(TEST_DIR, ".home");
		await writeTestSettings(homeDir, {
			textEditor: "nano",
		});

		const settings = await readTestSettings(homeDir);
		expect(settings).toBeDefined();
		expect(settings?.textEditor).toBe("nano");
	});
});
