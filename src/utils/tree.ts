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

import { FileTreeNode } from "../types/types.js";
import * as FileUtils from "./files.js";
import * as MiscUtils from "./misc.js";

export function extractStructureFromTree(tree: string): {
	structure: FileTreeNode[] | null;
	parameters: string[] | null;
} {
	const chars = {
		branch: "├",
		node: "─",
		comment: "#",
		lastNode: "└",
		trunk: "│",
	};

	const illegalChars = [
		" ",
		"<",
		">",
		":",
		'"',
		"/",
		"\\",
		"|",
		"?",
		"*",
		"\0",
		// Includes ASCII control characters 0 to 31
		...Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)),
	];

	const treeLines: string[] = tree.split("\n");
	const struct: FileTreeNode[] = [];
	const levelDirs: any = {};
	const parameters: Set<string> = new Set<string>();

	for (let i = 0; i < treeLines.length; ++i) {
		let s = treeLines[i];
		const p = s.indexOf(chars.comment);

		if (p >= 0) {
			s = s.substring(0, p);
		}

		const st = s.trim();

		if (st.length == 0 || st.endsWith(chars.trunk)) continue;

		let counter = 0;
		let level = 0;
		let name = "";

		if (
			st[0] != chars.branch &&
			st[0] != chars.node &&
			st[0] != chars.lastNode &&
			st[0] != chars.trunk
		) {
			name = st.substring(0, st.length - 1).trim();
			if (name.length == 0) continue;
			if (MiscUtils.containsChar(name, illegalChars)) continue;
		} else {
			for (let j = 0; j < s.length; ++j) {
				if (
					s[j] == chars.branch ||
					s[j] == chars.lastNode ||
					s[j] == chars.trunk
				) {
					counter = 1;
				} else if (s[j] == " " || s[j] == chars.node) {
					++counter;
					if (counter == 3) {
						counter = 0;
						++level;
					}
				} else if (s[j] != chars.node) {
					name = s.substring(j).trim();
					break;
				}
			}

			name = st.endsWith("/") ? name.substring(0, name.length - 1) : name;
			if (name.length == 0) continue;
			if (MiscUtils.containsChar(name, illegalChars)) continue;
		}

		let path = "";
		for (let j = 0; j < level; ++j) {
			path += "/" + levelDirs[j];
		}
		path += "/" + name;

		struct.push({
			type: st.endsWith("/") ? "dir" : "file",
			level: level,
			name: name,
			path: path,
		});

		const params = MiscUtils.getParametersFromFilename(name);
		params.forEach((param: string) => {
			parameters.add(param);
		});

		if (st.endsWith("/")) levelDirs[level] = name;
	}

	if (struct.length <= 1) {
		return { structure: null, parameters: null };
	}

	return { structure: struct, parameters: Array.from(parameters) };
}

export function extractStructureFromTemplateFile(filePath: string): {
	structure: FileTreeNode[] | null;
	parameters: string[] | null;
} {
	// TODO: add code
}

export async function createTemplateFileFromDirectory(
	dirPath: string,
	targetTemplateFile: string,
	preExtractScriptPath: string | null = null,
	postExtractScriptPath: string | null = null,
	withContent: boolean = false,
): Promise<boolean> {
	const nodes: FileTreeNode[] = getFileTreeNodesFromDirectory(
		dirPath,
		withContent,
	);

	let preScript = null;
	let postScript = null;

	if (preExtractScriptPath) {
		preExtractScriptPath = FileUtils.resolveFilePaths([
			preExtractScriptPath,
		])[0];
		preScript = await FileUtils.readTextFile(preExtractScriptPath);
	}

	if (postExtractScriptPath) {
		postExtractScriptPath = FileUtils.resolveFilePaths([
			postExtractScriptPath,
		])[0];
		postScript = await FileUtils.readTextFile(postExtractScriptPath);
	}

	// TODO: add code
}

export function createTree(
	structure: FileTreeNode[],
	parameters: Record<string, string>,
): boolean {
	// TODO: add code
}

export function addTreeContentInteractive(
	structure: FileTreeNode[],
	parameters: Record<string, string>,
): boolean {
	// TODO: add code
}

// ------------------------- [private] -----------------------------

async function getFileTreeNodesFromDirectory(
	dirPath: string,
	readContent: boolean = false,
): Promise<FileTreeNode[]> {
	const rootPath = FileUtils.resolveFilePaths([dirPath])[0];
	const nodes: FileTreeNode[] = [];

	async function traverse(currentDirPath: string, level: number) {
		const entries = FileUtils.readDirectoryContentsWithTypes(currentDirPath);

		// Sort entries so directories appear first, then alphabetically
		entries.sort((a, b) => {
			if (a.isDirectory() && !b.isDirectory()) return -1;
			if (!a.isDirectory() && b.isDirectory()) return 1;
			return a.name.localeCompare(b.name);
		});

		for (const entry of entries) {
			const fullPath = FileUtils.formPath([currentDirPath, entry.name]);

			// Calculate relative path starting with a leading slash
			const relativePath = "/" + FileUtils.formRelativePath(rootPath, fullPath);

			if (entry.isDirectory()) {
				nodes.push({
					type: "dir",
					level,
					name: entry.name,
					path: relativePath,
					content: null,
				});

				// Recurse into directory
				traverse(fullPath, level + 1);
			} else if (entry.isFile()) {
				let content: string | null = null;

				if (readContent) {
					content = await FileUtils.readTextFile(fullPath);
				}

				nodes.push({
					type: "file",
					level,
					name: entry.name,
					path: relativePath,
					content,
				});
			}
		}
	}

	await traverse(rootPath, 0);
	return nodes;
}
