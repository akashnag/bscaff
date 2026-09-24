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
import * as os from "node:os";
import * as path from "node:path";
import { execa, type Options } from "execa";

const CLI_PATH = path.resolve(__dirname, "../../dist/index.js");
export const TEST_DIR = path.join(os.tmpdir(), "bscaff-test-");

export async function createTestDir(): Promise<void> {
	await fs.mkdtemp(TEST_DIR);
}

export async function cleanupTestDir(): Promise<void> {
	await fs.rm(TEST_DIR, {
		recursive: true,
		force: true,
		maxRetries: 5, // Retry in case process/file streams haven't closed yet
		retryDelay: 100, // Wait 100ms between retries
	});
}

export function executeCLI(
	args: string[],
	cwd: string,
	options: Options = {},
): ReturnType<typeof execa> {
	return execa("node", [CLI_PATH, ...args], {
		cwd,
		reject: false,
		...options,
	});
}
