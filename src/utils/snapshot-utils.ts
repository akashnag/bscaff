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

import { Config } from "../core/config.js";
import { Store } from "../core/store.js";
import { ScriptMissingError } from "../types/errors.js";
import { FileTreeNode, SnapshotRecord, SnapshotType } from "../types/types.js";
import * as FileUtils from "./file-utils.js";
import * as MiscUtils from "./misc-utils.js";
import * as ParamUtils from "./param-utils.js";

export function getSnapshotDB(): string {
	return Config.getStoragePath([Config.SNAPSHOT_DB_FILE]);
}

export function getSnapshotDirectory(key: string): string {
	return Config.getStoragePath([key]);
}

export function getFileUnderSnapshot(key: string, relFilePath: string): string {
	const platform = MiscUtils.getPlatform();
	const delim = platform === "win32" ? "\\" : "/";
	const parts = relFilePath.split(delim);
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
	return FileUtils.renameDirectory(oldPath, newPath);
}

export function deleteFileUnderSnapshot(
	store: Store,
	key: string,
	relPath: string,
): boolean {
	const record = store.fetch(key);
	if (!record) return false;

	if (
		record.type != SnapshotType.Files &&
		record.type != SnapshotType.Tree &&
		record.type != SnapshotType.Template
	) {
		return false;
	}

	const struct = record.structure;
	if (!struct) return false;

	if (!relPath.startsWith("/")) relPath = "/" + relPath;

	for (let i = 0; i < struct.length; ++i) {
		if (struct[i].path === relPath && struct[i].type === "file") {
			const filePath = getFileUnderSnapshot(key, relPath);
			struct.splice(i, 1);
			if (store.updateStructure(key, struct)) {
				if (FileUtils.deleteFile(filePath)) {
					return true;
				}
			}
			break;
		}
	}

	return false;
}

export function doesSnapshotContainDirectory(
	record: SnapshotRecord,
	relPath: string,
): boolean {
	// TODO: add code
}

export function deleteDirectoryUnderSnapshot(
	store: Store,
	key: string,
	relPath: string,
): boolean {
	// TODO: add code
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

export async function computeSnapshotSize(
	key: string,
	record: SnapshotRecord,
): Promise<string> {
	if (!record) return `0 B`;

	if (record.type == SnapshotType.URL) {
		return "1 line";
	} else if (
		record.type == SnapshotType.Snippet ||
		record.type == SnapshotType.Template
	) {
		const content = await readContentFromSnapshotFile(key, record.fileName!);
		if (!content) return `0 B`;
		if (record.type == SnapshotType.Snippet) {
			return `${MiscUtils.countLines(content)} lines`;
		} else {
			return (
				MiscUtils.formatFileSize(MiscUtils.getSizeOfTextContent(content)) ??
				`0 B`
			);
		}
	} else if (
		record.type == SnapshotType.Tree ||
		record.type == SnapshotType.Files
	) {
		if (!record.structure) return `0 B`;
		let size = 0;
		for (let i = 0; i < record.structure.length; ++i) {
			if (record.structure[i].type == "file") {
				size +=
					record.structure[i].sizeInBytes ??
					FileUtils.getFileSizeInBytes(
						getFileUnderSnapshot(key, record.structure[i].path),
					) ??
					0;
			}
		}
		return MiscUtils.formatFileSize(size) ?? `0 B`;
	} else {
		return `0 B`;
	}
}

export async function doesSnapshotContainFile(
	record: SnapshotRecord,
	relPath: string,
): Promise<boolean> {
	let structure: FileTreeNode[] | undefined | null = undefined;

	if (
		record.type == SnapshotType.Files ||
		record.type == SnapshotType.Tree ||
		record.type == SnapshotType.Template
	) {
		structure = record.structure;
	}

	if (!structure) return false;

	if (!relPath.startsWith("/")) relPath = "/" + relPath;
	for (let i = 0; i < structure.length; ++i) {
		if (structure[i].path === relPath) return true;
	}

	return false;
}

export function getStatsFromStructure(nodes: FileTreeNode[]): {
	sizeInBytes: number;
	fileCount: number;
	dirCount: number;
} {
	let sizeInBytes = 0,
		fileCount = 0,
		dirCount = 0;

	for (let i = 0; i < nodes.length; ++i) {
		const currentNode = nodes[i];

		if (currentNode.type == "file") {
			++fileCount;
			if (currentNode.sizeInBytes) sizeInBytes += currentNode.sizeInBytes;
		} else {
			++dirCount;
		}
	}

	return { sizeInBytes, fileCount, dirCount };
}

// only copies files, not directories. assumes filenames are absolute paths
export async function copyFilesToSnapshotDirectory(
	key: string,
	files: string[],
): Promise<{
	structure: FileTreeNode[];
	parameters: string[];
	stats: { sizeInBytes: number; fileCount: number; dirCount: number };
}> {
	const localDir = getSnapshotDirectory(key);

	const structure: FileTreeNode[] = [];
	const parameters: Set<string> = new Set<string>();
	const stats = {
		sizeInBytes: 0,
		fileCount: 0,
		dirCount: 0,
	};

	for (let i = 0; i < files.length; ++i) {
		const fileName = FileUtils.getFileNameFromPath(files[i]);
		const localFile = FileUtils.formPath([localDir, fileName]);

		if (FileUtils.copyFile(files[i], localFile)) {
			const size = FileUtils.getFileSizeInBytes(localFile) ?? 0;
			const params = ParamUtils.getParametersFromText(fileName);

			stats.sizeInBytes + size;
			++stats.fileCount;
			params.push(
				...(await ParamUtils.getParametersFromFileContent(localFile)),
			);

			params.forEach((param) => {
				parameters.add(param);
			});

			structure.push({
				type: "file",
				level: 0,
				name: fileName,
				path: fileName,
				sizeInBytes: size,
			});
		}
	}

	return {
		structure,
		parameters: Array.from(parameters),
		stats,
	};
}
