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

import { ScriptMissingError } from "../types/errors.js";
import { FileTreeNode, SnapshotType } from "../types/types.js";
import { Config } from "./config.js";
import * as FileUtils from "./files.js";
import * as MiscUtils from "./misc.js";

export function getSnapshotDB(): string {
	return Config.getStoragePath([Config.SNAPSHOT_DB_FILE]);
}

export function getSnapshotDirectory(key: string): string {
	return Config.getStoragePath([key]);
}

export function getFileUnderSnapshot(key: string, filePath: string): string {
	const platform = MiscUtils.getPlatform();
	const delim = platform === "win32" ? "\\" : "/";
	const parts = filePath.split(delim);
	return Config.getStoragePath([key, ...parts]);
}

export function createSnapshotDirectory(key: string): boolean {
	FileUtils.createDirectory(getSnapshotDirectory(key));
	return true;
}

export function deleteSnapshotDirectory(key: string): boolean {
	FileUtils.deleteDirectory(getSnapshotDirectory(key));
	return true;
}

export function renameSnapshotDirectory(
	oldKey: string,
	newKey: string,
): boolean {
	const oldPath = getSnapshotDirectory(oldKey);
	const newPath = getSnapshotDirectory(newKey);
	FileUtils.renameDirectory(oldPath, newPath);
	return true;
}

export function writeContentToSnapshotFile(
	content: string,
	key: string,
	filePath: string,
): boolean {
	FileUtils.writeTextFile(getFileUnderSnapshot(key, filePath), content);
	return true;
}

export async function readContentFromSnapshotFile(
	key: string,
	filePath: string,
): Promise<string | null> {
	return await FileUtils.readTextFile(getFileUnderSnapshot(key, filePath));
}

export function copyTriggerScripts(
	key: string,
	preExtractScriptPath: string | null = null,
	postExtractScriptPath: string | null = null,
): {
	type: "path" | "content";
	preScript: string | null;
	postScript: string | null;
} {
	const snippetDir = getSnapshotDirectory(key);
	const retVal: {
		type: "path" | "content";
		preScript: string | null;
		postScript: string | null;
	} = {
		type: "path",
		preScript: null,
		postScript: null,
	};

	// resolve file paths to absolute paths
	if (preExtractScriptPath) {
		preExtractScriptPath = FileUtils.resolvePath(preExtractScriptPath);
		if (!FileUtils.doesFileExist(preExtractScriptPath)) {
			throw new ScriptMissingError("pre", preExtractScriptPath);
		}
	}

	if (postExtractScriptPath) {
		postExtractScriptPath = FileUtils.resolvePath(postExtractScriptPath);
		if (!FileUtils.doesFileExist(postExtractScriptPath)) {
			throw new ScriptMissingError("post", postExtractScriptPath);
		}
	}

	if (preExtractScriptPath) {
		const fileType = FileUtils.getFileType(preExtractScriptPath, true, "");
		FileUtils.copyFile(
			preExtractScriptPath,
			FileUtils.formPath([snippetDir, `pre-script${fileType}`]),
		);
		retVal.preScript = `pre-script${fileType}`;
	}

	if (postExtractScriptPath) {
		const fileType = FileUtils.getFileType(postExtractScriptPath, true, "");
		FileUtils.copyFile(
			postExtractScriptPath,
			FileUtils.formPath([snippetDir, `post-script${fileType}`]),
		);
		retVal.postScript = `post-script${fileType}`;
	}

	return retVal;
}

export function computeSnapshotSize(key: string, sType: SnapshotType): string {
	// TODO: add code
	return "0 B";
}
