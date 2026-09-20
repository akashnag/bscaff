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

import {
	DirectoryStructure,
	FileTreeNode,
	SnippetStructure,
	SnippetStructureItemType,
} from "../types/types.js";
import { Config } from "./config.js";
import * as FileUtils from "./file-utils.js";
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
	return await FileUtils.readSnippetFromFile(
		getFileUnderSnippet(key, filePath),
	);
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

export function drawSnippetFileTree(
	struct: SnippetStructure,
	prefix: string = "",
	isLast: boolean = true,
	lines: string[] = [],
): string {
	// Format and add the current node (skip the root DummyNode)
	if (struct.type !== SnippetStructureItemType.DummyNode) {
		const connector = isLast ? "└── " : "├── ";
		const isDir = struct.type === SnippetStructureItemType.Directory;
		const displayName = isDir ? `${struct.filename}/` : struct.filename;

		lines.push(`${prefix}${connector}${displayName}`);
	}

	// Recursively process children
	if (struct.type !== SnippetStructureItemType.File && struct.children) {
		let childPrefix = prefix;
		if (struct.type !== SnippetStructureItemType.DummyNode) {
			childPrefix += isLast ? "    " : "│   ";
		}

		const count = struct.children.length;
		for (let i = 0; i < count; ++i) {
			const childIsLast = i === count - 1;
			drawSnippetFileTree(struct.children[i], childPrefix, childIsLast, lines);
		}
	}

	// Return the complete string separated by newlines
	return lines.join("\n");
}

export async function getDirectoryStructureFromPath(
	dirPath: string,
): Promise<DirectoryStructure> {
	const parameters = new Set<string>();

	async function walk(currentPath: string): Promise<SnippetStructure> {
		const name = FileUtils.getFileNameFromPath(currentPath);

		// Extract parameters from the current file or directory name
		const params = MiscUtils.getParametersFromFilename(name);
		params.forEach((param: string) => {
			parameters.add(param);
		});

		// Check if the current item is a directory or a file
		const isDir = FileUtils.doesDirectoryExist(currentPath);

		if (isDir) {
			// Read all direct children inside the folder
			const entryNames = FileUtils.readDirectoryContents(currentPath);
			const children: SnippetStructure[] = [];

			for (const entryName of entryNames) {
				const childPath = Config.formPath([currentPath, entryName]);

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
			const loc = await MiscUtils.countLOCFromFile(currentPath);
			return {
				filename: name,
				type: SnippetStructureItemType.File,
				children: null,
			};
		}
	}

	// Start the recursive traversal from root dirPath
	const rootStructure = await walk(dirPath);

	return {
		structure: rootStructure,
		parameters: parameters,
	};
}

export async function getDirectoryStructureFromTree(
	tree: FileTreeNode[],
): Promise<DirectoryStructure> {
	const parameters = new Set<string>();

	// Root structure node set up as DummyNode with filename: null
	const rootStructure: SnippetStructure = {
		filename: null,
		type: SnippetStructureItemType.DummyNode,
		children: [],
	};

	// Lookup map to find created parent nodes by their normalized path
	const nodeMap = new Map<string, SnippetStructure>();

	// Sort nodes by level to guarantee parents exist before children are processed
	const sortedTree = [...tree].sort((a, b) => a.level - b.level);

	for (const node of sortedTree) {
		// Collect parameters from node name
		const params = MiscUtils.getParametersFromFilename(node.name);
		params.forEach((param: string) => {
			parameters.add(param);
		});

		const isDirectory = node.type === "dir";

		const currentStructureNode: SnippetStructure = {
			filename: node.name,
			type: isDirectory
				? SnippetStructureItemType.Directory
				: SnippetStructureItemType.File,
			children: isDirectory ? [] : null,
		};

		// Normalize path by removing leading/trailing slashes (e.g. "/src/components" -> "src/components")
		const normalizedPath = node.path.replace(/^\/+|\/+$/g, "");
		nodeMap.set(normalizedPath, currentStructureNode);

		const lastSlashIdx = normalizedPath.lastIndexOf("/");

		if (lastSlashIdx !== -1) {
			// Child item: resolve parent path
			const parentPath = normalizedPath.substring(0, lastSlashIdx);
			const parentNode = nodeMap.get(parentPath);

			if (parentNode && parentNode.children) {
				parentNode.children.push(currentStructureNode);
			} else {
				// Fallback to root if explicit parent dir entry was omitted from tree
				rootStructure.children?.push(currentStructureNode);
			}
		} else {
			// Top-level item directly under root
			rootStructure.children?.push(currentStructureNode);
		}
	}

	return {
		structure: rootStructure,
		parameters: parameters,
	};
}

export function copyTriggerScripts(
	key: string,
	preExtractScript: string | null = null,
	postExtractScript: string | null = null,
): { preScript: string | null; postScript: string | null } {
	const snippetDir = getSnippetDirectory(key);
	const retVal: { preScript: string | null; postScript: string | null } = {
		preScript: null,
		postScript: null,
	};

	if (preExtractScript && FileUtils.doesFileExist(preExtractScript)) {
		const fileType = MiscUtils.getFileType(preExtractScript, true, "");
		FileUtils.copyFile(
			preExtractScript,
			Config.formPath([snippetDir, `pre-script${fileType}`]),
		);
		retVal.preScript = `pre-script${fileType}`;
	}

	if (postExtractScript && FileUtils.doesFileExist(postExtractScript)) {
		const fileType = MiscUtils.getFileType(postExtractScript, true, "");
		FileUtils.copyFile(
			postExtractScript,
			Config.formPath([snippetDir, `post-script${fileType}`]),
		);
		retVal.postScript = `post-script${fileType}`;
	}

	return retVal;
}
