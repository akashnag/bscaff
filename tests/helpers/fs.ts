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

/**
 * Creates a unique temporary directory for testing.
 *
 * @param prefix - Optional directory prefix (defaults to "bscaff-test-")
 * @returns The absolute path to the created directory
 */
export async function createTempDir(prefix = "bscaff-test-"): Promise<string> {
	return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

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
 * Checks if a file exists at the given path.
 */
export async function fileExists(filePath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(filePath);
		return stat.isFile();
	} catch {
		return false;
	}
}

/**
 * Checks if a directory exists at the given path.
 */
export async function dirExists(dirPath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(dirPath);
		return stat.isDirectory();
	} catch {
		return false;
	}
}

/**
 * Reads a text file's contents using utf-8 encoding.
 */
export async function readFile(filePath: string): Promise<string> {
	return await fs.readFile(filePath, "utf-8");
}

/**
 * Writes text content to a file, creating parent directories if they don't exist.
 */
export async function writeFile(
	filePath: string,
	content: string,
): Promise<void> {
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, content, "utf-8");
}

/**
 * Reads and parses a JSON file.
 */
export async function readJsonFile<T = any>(filePath: string): Promise<T> {
	const content = await readFile(filePath);
	return JSON.parse(content) as T;
}

/**
 * Serializes and writes data to a JSON file.
 */
export async function writeJsonFile(
	filePath: string,
	data: any,
): Promise<void> {
	await writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Definition of a file tree where keys are relative file paths (POSIX style)
 * and values are file contents (or null/empty string for an empty file).
 * If a path ends with '/', a directory is created.
 */
export type FileTreeDefinition = Record<string, string | null>;

/**
 * Creates a file and directory tree under `baseDir` based on a dictionary definition.
 *
 * Example:
 * ```ts
 * await createFileTree(tempDir, {
 *   "src/index.ts": "console.log('hello');",
 *   "docs/README.md": "# Docs",
 *   "empty-dir/": null
 * });
 * ```
 */
export async function createFileTree(
	baseDir: string,
	tree: FileTreeDefinition,
): Promise<void> {
	for (const [relPath, content] of Object.entries(tree)) {
		const fullPath = path.resolve(baseDir, relPath);

		if (relPath.endsWith("/") || content === null) {
			if (relPath.endsWith("/")) {
				await fs.mkdir(fullPath, { recursive: true });
			} else {
				await writeFile(fullPath, "");
			}
		} else {
			await writeFile(fullPath, content);
		}
	}
}

export interface ReadTreeOptions {
	/** Globs or substrings of directory/file names to ignore (e.g. [".git", "node_modules"]) */
	ignore?: string[];
	/** If true (default), returns file contents. If false, returns empty strings */
	includeContent?: boolean;
}

/**
 * Recursively reads all files in a directory and returns an object mapping
 * normalized relative paths (with forward slashes '/') to file contents.
 *
 * Essential for asserting generated scaffolding output against expected fixtures.
 */
export async function readFileTree(
	dir: string,
	options: ReadTreeOptions = {},
): Promise<Record<string, string>> {
	const result: Record<string, string> = {};
	const ignore = options.ignore ?? [".git"];
	const includeContent = options.includeContent !== false;

	async function walk(currentDir: string, relPrefix = ""): Promise<void> {
		if (!(await dirExists(currentDir))) return;

		const entries = await fs.readdir(currentDir, { withFileTypes: true });

		for (const entry of entries) {
			const entryName = entry.name;
			if (ignore.some((ig) => entryName === ig || entryName.startsWith(`${ig}/`))) {
				continue;
			}

			const fullEntryPath = path.join(currentDir, entryName);
			const relEntryPath = relPrefix ? `${relPrefix}/${entryName}` : entryName;

			if (entry.isDirectory()) {
				await walk(fullEntryPath, relEntryPath);
			} else if (entry.isFile()) {
				result[relEntryPath] = includeContent
					? await fs.readFile(fullEntryPath, "utf-8")
					: "";
			}
		}
	}

	await walk(dir);
	return result;
}

/**
 * Returns a sorted list of relative paths for all files found in `dir`.
 */
export async function listFileTree(
	dir: string,
	options: ReadTreeOptions = {},
): Promise<string[]> {
	const tree = await readFileTree(dir, { ...options, includeContent: false });
	return Object.keys(tree).sort();
}
