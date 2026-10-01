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
import { Config } from "../../src/core/config.js";
import type {
	BScaffSettings,
	FileTreeNode,
	SnapshotRecord,
	SnapshotType,
} from "../../src/types/types.js";
import {
	createFileTree,
	dirExists,
	fileExists,
	listFileTree,
	readJsonFile,
	writeJsonFile,
} from "./fs.js";

/**
 * Returns the path to the .bscaff storage directory inside the given isolated HOME directory.
 */
export function getTestStoragePath(
	homeDir: string,
	...segments: string[]
): string {
	return path.join(homeDir, Config.DIRECTORY_NAME, ...segments);
}

/**
 * Reads the snapshot database (`db.json`) from an isolated HOME directory.
 *
 * @param homeDir - Isolated home directory
 * @returns Array of snapshot records or empty array if db doesn't exist
 */
export async function readTestDB(homeDir: string): Promise<SnapshotRecord[]> {
	const dbFile = getTestStoragePath(homeDir, Config.SNAPSHOT_DB_FILE);
	if (!(await fileExists(dbFile))) {
		return [];
	}
	return await readJsonFile<SnapshotRecord[]>(dbFile);
}

/**
 * Writes records to the snapshot database (`db.json`) in an isolated HOME directory.
 */
export async function writeTestDB(
	homeDir: string,
	records: SnapshotRecord[],
): Promise<void> {
	const dbFile = getTestStoragePath(homeDir, Config.SNAPSHOT_DB_FILE);
	await writeJsonFile(dbFile, records);
}

/**
 * Direct seed helper that populates a snapshot record and its files into the test storage.
 *
 * Allows test suites to establish preconditions without having to invoke `bscaff save` CLI commands.
 *
 * @param homeDir - Isolated HOME directory
 * @param record - Snapshot record properties
 * @param files - Optional dictionary of files to create under `.bscaff/<key>/`
 */
export async function seedSnapshot(
	homeDir: string,
	record: Partial<SnapshotRecord> & { key: string; type: SnapshotType },
	files?: Record<string, string>,
): Promise<SnapshotRecord> {
	const fullRecord: SnapshotRecord = {
		key: record.key,
		type: record.type,
		description: record.description ?? `Test snapshot ${record.key}`,
		tags: record.tags ?? ["test"],
		createdAt: record.createdAt ?? new Date(),
		modifiedAt: record.modifiedAt ?? new Date(),
		structure: record.structure,
		parameters: record.parameters ?? [],
		fileName: record.fileName,
		urlContent: record.urlContent,
		gitRepoSource: record.gitRepoSource,
	};

	// Save files under the snapshot directory if provided
	if (files && Object.keys(files).length > 0) {
		const snapshotDir = getTestStoragePath(homeDir, record.key);
		await createFileTree(snapshotDir, files);

		// If structure wasn't explicitly provided, build a basic FileTreeNode structure
		if (!fullRecord.structure) {
			const struct: FileTreeNode[] = Object.keys(files).map((relPath) => ({
				type: "file",
				level: relPath.split("/").length - 1,
				name: path.basename(relPath),
				path: relPath,
				sizeInBytes: Buffer.byteLength(files[relPath], "utf-8"),
			}));
			fullRecord.structure = struct;
		}
	}

	const currentDB = await readTestDB(homeDir);
	const existingIndex = currentDB.findIndex((r) => r.key === record.key);
	if (existingIndex >= 0) {
		currentDB[existingIndex] = fullRecord;
	} else {
		currentDB.push(fullRecord);
	}

	await writeTestDB(homeDir, currentDB);
	return fullRecord;
}

/**
 * Reads user settings from `settings.json` in the test storage directory.
 */
export async function readTestSettings(
	homeDir: string,
): Promise<BScaffSettings | null> {
	const settingsFile = getTestStoragePath(homeDir, Config.SETTINGS_FILE);
	if (!(await fileExists(settingsFile))) {
		return null;
	}
	return await readJsonFile<BScaffSettings>(settingsFile);
}

/**
 * Writes user settings to `settings.json` in the test storage directory.
 */
export async function writeTestSettings(
	homeDir: string,
	settings: Partial<BScaffSettings>,
): Promise<void> {
	const settingsFile = getTestStoragePath(homeDir, Config.SETTINGS_FILE);
	const current = (await readTestSettings(homeDir)) ?? {
		textEditor: "nano",
		browser: "xdg-open",
		templatesSuffix: ".jinja",
		include: [],
		exclude: [".git", "node_modules"],
	};
	const updated = { ...current, ...settings };
	await writeJsonFile(settingsFile, updated);
}

/**
 * Lists all file paths stored on disk for a given snapshot key in `.bscaff/<key>`.
 */
export async function getSnapshotDiskFiles(
	homeDir: string,
	key: string,
): Promise<string[]> {
	const snapshotDir = getTestStoragePath(homeDir, key);
	if (!(await dirExists(snapshotDir))) {
		return [];
	}
	return await listFileTree(snapshotDir);
}
