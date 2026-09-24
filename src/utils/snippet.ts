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
import {
	DirectoryStructure,
	FileTreeNode,
	SnippetStructure,
	SnippetStructureItemType,
} from "../types/types.js";
import { Config } from "./config.js";
import * as FileUtils from "./files.js";
import * as MiscUtils from "./misc.js";

export function getSnippetsListDBPath(): string {
	return Config.getStoragePath([Config.SNIPPET_DB_FILE]);
}

export function getSnippetDirectory(key: string): string {
	return Config.getStoragePath([key]);
}

export function getFileUnderSnippet(key: string, filePath: string): string {
	const platform = MiscUtils.getPlatform();
	const delim = platform === "win32" ? "\\" : "/";
	const parts = filePath.split(delim);
	return Config.getStoragePath([key, ...parts]);
}

export function createSnippetDirectory(key: string): boolean {
	FileUtils.createDirectory(getSnippetDirectory(key));
	return true;
}

export function deleteSnippetDirectory(key: string): boolean {
	FileUtils.deleteDirectory(getSnippetDirectory(key));
	return true;
}

export function renameSnippetDirectory(
	oldKey: string,
	newKey: string,
): boolean {
	const oldPath = getSnippetDirectory(oldKey);
	const newPath = getSnippetDirectory(newKey);
	FileUtils.renameDirectory(oldPath, newPath);
	return true;
}

export function writeContentToSnippetFile(
	content: string,
	key: string,
	filePath: string,
): boolean {
	FileUtils.writeTextFile(getFileUnderSnippet(key, filePath), content);
	return true;
}

export async function readContentFromSnippetFile(
	key: string,
	filePath: string,
): Promise<string | null> {
	return await FileUtils.readTextFile(getFileUnderSnippet(key, filePath));
}

export function listSnippetFiles(
	struct: SnippetStructure,
	path: string = "",
	data: object[] = [],
): object[] {
	if (struct.type !== SnippetStructureItemType.DummyNode) {
		data.push({
			type: struct.type.toString(),
			name: `${path}/${struct.filename}`,
		});
	}

	if (struct.type !== SnippetStructureItemType.File) {
		for (let i = 0; i < struct.children!.length; ++i) {
			const newPath =
				struct.type === SnippetStructureItemType.Directory
					? `${path}/${struct.filename}`
					: path;
			listSnippetFiles(struct.children![i], newPath, data);
		}
	}

	return data;
}

export async function getDirectoryStructureFromPath(
	dirPath: string,
): Promise<DirectoryStructure> {
	const parameters = new Set<string>();
	let totalSize = 0,
		fileCount = 0,
		dirCount = 0;

	async function walk(currentPath: string): Promise<SnippetStructure> {
		const name = FileUtils.getFileNameFromPath(currentPath);

		// Extract parameters from the current file or directory name
		const params = MiscUtils.getParametersFromText(name);
		params.forEach((param: string) => {
			parameters.add(param);
		});

		// Check if the current item is a directory or a file
		const isDir = FileUtils.doesDirectoryExist(currentPath);

		if (isDir) {
			++dirCount;

			// Read all direct children inside the folder
			const entryNames = FileUtils.readDirectoryContents(currentPath);
			const children: SnippetStructure[] = [];

			for (const entryName of entryNames) {
				const childPath = FileUtils.formPath([currentPath, entryName]);

				// Recursively walk into each child item
				const childStructure = await walk(childPath);
				children.push(childStructure);
			}

			return {
				filename: name,
				type: SnippetStructureItemType.Directory,
				children: children,
			};
		} else {
			const size = FileUtils.getFileSizeInBytes(currentPath);
			++fileCount;
			if (size !== null) totalSize += size;

			return {
				filename: name,
				type: SnippetStructureItemType.File,
				children: null,
				sizeInBytes: size,
			};
		}
	}

	// Start the recursive traversal from root dirPath
	const rootStructure = await walk(dirPath);

	return {
		structure: rootStructure,
		parameters: parameters,
		sizeInBytes: totalSize,
		fileCount: fileCount,
		dirCount: dirCount,
	};
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
	const snippetDir = getSnippetDirectory(key);
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
