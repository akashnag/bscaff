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

import * as FileUtils from "../../src/utils/file-utils.js";

// Set of tracked test directories for cleanup
const trackedDirs: Set<string> = new Set();
export const TEST_DIR = path.join(os.tmpdir(), "bscaff-test-sandbox");
export const TEST_HOME_DIR_NAME = ".home";
export const TEST_HOME_DIR = path.join(TEST_DIR, TEST_HOME_DIR_NAME);
export const TEST_DB_FILE = path.join(
	TEST_DIR,
	TEST_HOME_DIR_NAME,
	".bscaff/db.json",
);

// Recursively cleans up a directory with retry logic to avoid file lock issues
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

// Creates the test directory and an isolated .home folder, tracking it for cleanup
async function createTestDir(): Promise<string> {
	await cleanupDir(TEST_DIR);
	await fs.mkdir(TEST_DIR, { recursive: true });
	const homeDir = path.join(TEST_DIR, ".home");
	await fs.mkdir(homeDir, { recursive: true });
	trackedDirs.add(TEST_DIR);
	return TEST_DIR;
}

// Cleans up all tracked temporary directories
async function cleanupTestDir(): Promise<void> {
	await cleanupDir(TEST_DIR);
	for (const dir of trackedDirs) {
		await cleanupDir(dir);
	}
	trackedDirs.clear();
}

export function cleanDir(dirPath: string): void {
	FileUtils.deleteDirectory(dirPath);
	FileUtils.createDirectory(dirPath);
}

export async function teardownTestEnvironment(): Promise<void> {
	await cleanupTestDir();
}

export async function setupTestEnvironment(): Promise<{
	sourceTreeDir: string;
	sourceFilesDir: string;
	extractTargetDir: string;
}> {
	await teardownTestEnvironment();
	await createTestDir();

	const sourceTreeDir: string = path.join(TEST_DIR, "sample-tree");
	const sourceFilesDir: string = path.join(TEST_DIR, "sample-files");
	const extractTargetDir: string = path.join(TEST_DIR, "extracted-output");

	await fs.mkdir(path.join(sourceTreeDir, "src"), { recursive: true });
	await fs.writeFile(
		path.join(sourceTreeDir, "src", "index.ts"),
		'console.log("Hello Tree");',
	);
	await fs.writeFile(path.join(sourceTreeDir, "README.md"), "# Tree Project");

	await fs.mkdir(sourceFilesDir, { recursive: true });
	await fs.writeFile(
		path.join(sourceFilesDir, "config.json"),
		'{"env": "test"}',
	);
	await fs.writeFile(
		path.join(sourceFilesDir, "logger.ts"),
		"export const log = console.log;",
	);

	return {
		sourceTreeDir,
		sourceFilesDir,
		extractTargetDir,
	};
}

export function doFilesExist(rootDir: string, relPaths: string[]): boolean {
	for (let i = 0; i < relPaths.length; ++i) {
		const p = FileUtils.formPath([rootDir, relPaths[i]]);
		if (!FileUtils.doesFileExist(p)) {
			return false;
		}
	}

	return true;
}

export function doNoneOfTheFilesExist(
	rootDir: string,
	relPaths: string[],
): boolean {
	for (let i = 0; i < relPaths.length; ++i) {
		const p = FileUtils.formPath([rootDir, relPaths[i]]);
		if (FileUtils.doesFileExist(p)) {
			console.log(`File exists: ${p}`);
			return false;
		}
	}

	return true;
}
