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

// Set of tracked test directories for cleanup
const trackedDirs: Set<string> = new Set();
export const TEST_DIR = path.join(os.tmpdir(), "bscaff-test-sandbox");

/**
 * Recursively cleans up a directory with retry logic to avoid file lock issues.
 *
 * @param dirPath - Path to directory to remove
 */
export async function cleanupDir(dirPath: string): Promise<void> {
	try {
		await fs.rm(dirPath, {
			recursive: true,
			force: true,
			maxRetries: 5,
			retryDelay: 100,
		});
	} catch (err: any) {
		if (err.code !== "ENOENT") {
			throw err;
		}
	}
}

/**
 * Creates the test directory and an isolated .home folder, tracking it for cleanup.
 *
 * @returns The absolute path of the created directory
 */
export async function createTestDir(): Promise<string> {
	await cleanupDir(TEST_DIR);
	await fs.mkdir(TEST_DIR, { recursive: true });
	const homeDir = path.join(TEST_DIR, ".home");
	await fs.mkdir(homeDir, { recursive: true });
	trackedDirs.add(TEST_DIR);
	return TEST_DIR;
}

/**
 * Cleans up all tracked temporary directories.
 */
export async function cleanupTestDir(): Promise<void> {
	await cleanupDir(TEST_DIR);
	for (const dir of trackedDirs) {
		await cleanupDir(dir);
	}
	trackedDirs.clear();
}
