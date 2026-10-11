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
import { Settings } from "../core/settings.js";
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
	const dir = getSnapshotDirectory(key);
	if (FileUtils.doesDirectoryExist(dir)) return true;
	FileUtils.createDirectory(dir);
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
	// WARNING: store.update() must be called at caller-end
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

	for (let i = 0; i < struct.length; ++i) {
		if (
			FileUtils.areRelativePathsSame(struct[i].path, relPath) &&
			struct[i].type === "file"
		) {
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
	const dirExists = FileUtils.doesDirectoryExist(
		getFileUnderSnapshot(record.key, relPath),
	);
	if (record.structure) {
		let hasDir = false;
		for (let i = 0; i < record.structure.length; ++i) {
			const node = record.structure[i];
			if (node.type === "dir") {
				if (FileUtils.areRelativePathsSame(relPath, node.path)) {
					hasDir = true;
					break;
				}
			}
		}
		return dirExists && hasDir;
	} else {
		return false;
	}
}

export function deleteDirectoryUnderSnapshot(
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

	for (let i = 0; i < struct.length; ++i) {
		if (
			struct[i].type === "dir" &&
			FileUtils.areRelativePathsSame(relPath, struct[i].path)
		) {
			const dirPath = getFileUnderSnapshot(key, relPath);
			if (FileUtils.deleteDirectory(dirPath)) {
				const newStruct: FileTreeNode[] = [];

				for (let k = 0; k < struct.length; ++k) {
					if (
						!FileUtils.isPathChild(
							struct[i].path,
							struct[k].path,
							struct[k].type,
						)
					) {
						newStruct.push(MiscUtils.deepClone(struct[k]));
					}
				}

				store.updateStructure(key, newStruct);
				return true;
			} else {
				return false;
			}
		}
	}

	return true; // directory does not exist, so it's as good as being deleted
}

export function writeContentToSnapshotFile(
	content: string,
	key: string,
	relFilePath: string,
): boolean {
	FileUtils.writeTextFile(getFileUnderSnapshot(key, relFilePath), content);
	return true;
}

export async function readContentFromSnapshotFile(
	key: string,
	filePath: string,
): Promise<string | null> {
	return await FileUtils.readTextFile(getFileUnderSnapshot(key, filePath));
}

export async function computeSnapshotSize(
	key: string,
	record: SnapshotRecord,
): Promise<string> {
	if (!record) return `0 B`;

	switch (record.type) {
		case SnapshotType.URL:
			return "1 line";

		case SnapshotType.Snippet:
			const content = await readContentFromSnapshotFile(
				key,
				record.snippetFileName!,
			);
			if (!content) return `0 B`;
			return `${MiscUtils.countLines(content)} lines`;

		case SnapshotType.Tree:
		case SnapshotType.Files:
		case SnapshotType.Template:
			if (!record.structure) return `0 B`;
			const snapshotDir = getSnapshotDirectory(key);

			let size = 0;
			for (let i = 0; i < record.structure.length; ++i) {
				if (record.structure[i].type == "file") {
					const filePath =
						record.type === SnapshotType.Template
							? FileUtils.formPath([
									snapshotDir,
									record.templateRootDir!,
									record.templateSubDirectoryPath ?? "",
									record.structure[i].path,
								])
							: FileUtils.formPath([snapshotDir, record.structure[i].path]);

					size +=
						record.structure[i].sizeInBytes ??
						FileUtils.getFileSizeInBytes(filePath) ??
						0;
				}
			}
			return MiscUtils.formatFileSize(size) ?? `0 B`;

		default:
			return `0 B`;
	}
}

export function doesSnapshotContainFile(
	record: SnapshotRecord,
	relPath: string,
): boolean {
	let structure: FileTreeNode[] | undefined | null = undefined;

	if (
		record.type == SnapshotType.Files ||
		record.type == SnapshotType.Tree ||
		record.type == SnapshotType.Template
	) {
		structure = record.structure;
	}

	if (!structure) return false;

	if (!FileUtils.doesFileExist(getFileUnderSnapshot(record.key, relPath))) {
		return false;
	}

	for (let i = 0; i < structure.length; ++i) {
		if (FileUtils.areRelativePathsSame(relPath, structure[i].path)) {
			if (structure[i].type === "file") return true;
		}
	}

	return false;
}

export function deleteFileOrDirectoryUnderSnapshot(
	key: string,
	relPath: string,
	pType: "file" | "dir",
	structure: FileTreeNode[],
): { structure: FileTreeNode[]; delFileCount: number; delDirCount: number } {
	const item = getFileUnderSnapshot(key, relPath);

	// assume the file/dir exists
	if (pType === "file") {
		FileUtils.deleteFile(item);
	} else {
		FileUtils.deleteDirectory(item);
	}

	const newStruct = [];
	let fileCount = 0,
		dirCount = 0;

	for (let i = 0; i < structure.length; ++i) {
		let skip = false;

		if (
			pType === "file" &&
			structure[i].type === "file" &&
			FileUtils.areRelativePathsSame(relPath, structure[i].path)
		) {
			skip = true;
		} else if (
			pType === "dir" &&
			FileUtils.isPathChild(relPath, structure[i].path, structure[i].type)
		) {
			skip = true;
		}

		if (!skip) {
			newStruct.push(structure[i]);
		} else {
			if (structure[i].type === "file") ++fileCount;
			else ++dirCount;
		}
	}

	return {
		structure: newStruct,
		delFileCount: fileCount,
		delDirCount: dirCount,
	};
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
// (WARNING: not to be used for templates)
export async function copyFilesToSnapshotDirectory(
	key: string,
	files: string[],
): Promise<{
	structure: FileTreeNode[];
	parameters: string[];
	stats: { sizeInBytes: number; fileCount: number; dirCount: number };
}> {
	const localDir = getSnapshotDirectory(key);
	const engine = ParamUtils.createTemplateEngine();
	const templatingOptions = {
		exclude: Settings.get("exclude") ?? Settings.DEFAULT_SETTINGS.exclude,
		include: Settings.get("include") ?? Settings.DEFAULT_SETTINGS.include,
		templatesSuffix:
			Settings.get("templatesSuffix") ??
			Settings.DEFAULT_SETTINGS.templatesSuffix,
	};

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

			const extractedParams = await ParamUtils.getParametersFromFileContent(
				localFile,
				templatingOptions,
				engine,
			);

			params.push(...extractedParams);

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

export function getRecordStructureIndexOfFileOrDirectoryFromRelativePath(
	record: SnapshotRecord,
	relPath: string,
): number {
	if (!record.structure) return -1;
	for (let i = 0; i < record.structure.length; ++i) {
		const node = record.structure[i];
		if (FileUtils.areRelativePathsSame(node.path, relPath)) {
			return i;
		}
	}
	return -1;
}
