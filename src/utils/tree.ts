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

import { ClipboardManager } from "../core/clipboard.js";
import { getche, prompt } from "../io/io.js";
import { Logger } from "../io/logger.js";
import { FileTreeNode, Template } from "../types/types.js";
import { Config } from "./config.js";
import * as FileUtils from "./files.js";
import * as MiscUtils from "./misc.js";

// converts an ASCII-art file-tree to FileTreeNode[]
export function extractStructureFromASCIITree(tree: string): {
	structure: FileTreeNode[] | null;
	parameters: string[] | null;
	stats: { fileCount: number; dirCount: number } | undefined;
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
	const parameters: Set<string> = new Set<string>();

	interface IntermediateNode {
		level: number;
		name: string;
		isExplicitDir: boolean;
	}

	const intermediateNodes: IntermediateNode[] = [];

	// PASS 1: Extract node levels, sanitized names, and explicit directory hints
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
			name = st.endsWith("/")
				? st.substring(0, st.length - 1).trim()
				: st.trim();
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

			const isExplicit = name.endsWith("/");
			name = isExplicit ? name.substring(0, name.length - 1) : name;
			if (name.length == 0) continue;
			if (MiscUtils.containsChar(name, illegalChars)) continue;
		}

		const isExplicitDir = st.endsWith("/");

		intermediateNodes.push({
			level,
			name,
			isExplicitDir,
		});

		const params = MiscUtils.getParametersFromText(name);
		params.forEach((param: string) => {
			parameters.add(param);
		});
	}

	if (intermediateNodes.length <= 1) {
		return { structure: null, parameters: null, stats: undefined };
	}

	const struct: FileTreeNode[] = [];
	const levelDirs: { [level: number]: string } = {};
	let fileCount = 0;
	let dirCount = 0;

	// PASS 2: Infer directory vs file types based on child relationships and resolve paths
	for (let i = 0; i < intermediateNodes.length; ++i) {
		const current = intermediateNodes[i];
		const next = intermediateNodes[i + 1];

		// A node is a directory if its next sibling/child is at a deeper level,
		// or if it was explicitly defined with a trailing slash
		const isDir =
			current.isExplicitDir ||
			(next !== undefined && next.level > current.level);

		let path = "";
		for (let j = 0; j < current.level; ++j) {
			if (levelDirs[j]) {
				path += "/" + levelDirs[j];
			}
		}
		path += "/" + current.name;

		if (isDir) {
			++dirCount;
			levelDirs[current.level] = current.name;
		} else {
			++fileCount;
		}

		struct.push({
			type: isDir ? "dir" : "file",
			level: current.level,
			name: current.name,
			path: path,
		});
	}

	return {
		structure: struct,
		parameters: Array.from(parameters),
		stats: { fileCount, dirCount },
	};
}

// converts a directory path to FileTreeNode[]
export async function extractStructureFromDirectory(
	dirPath: string,
	readContent: boolean = false,
): Promise<{
	structure: FileTreeNode[] | null;
	parameters: string[] | null;
	stats: { sizeInBytes: number; fileCount: number; dirCount: number };
}> {
	const nodes: FileTreeNode[] = [];
	const parameters: Set<string> = new Set<string>();
	const stats = {
		sizeInBytes: 0,
		fileCount: 0,
		dirCount: 0,
	};

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
			const relativePath = "/" + FileUtils.formRelativePath(dirPath, fullPath);

			const params: string[] = MiscUtils.getParametersFromText(entry.name);

			if (entry.isDirectory()) {
				++stats.dirCount;

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
				++stats.fileCount;
				stats.sizeInBytes += FileUtils.getFileSizeInBytes(fullPath) ?? 0;

				let content: string | null = null;

				if (readContent) {
					content = await FileUtils.readTextFile(fullPath);
					if (content) params.push(...MiscUtils.getParametersFromText(content));
				}

				nodes.push({
					type: "file",
					level,
					name: entry.name,
					path: relativePath,
					content,
				});
			}

			params.forEach((param: string) => {
				parameters.add(param);
			});
		}
	}

	await traverse(dirPath, 0);

	return {
		structure: nodes,
		parameters: Array.from(parameters),
		stats: stats,
	};
}

// creates the file structure on disk (include content if available)
export async function createTree(
	path: string | null,
	structure: FileTreeNode[],
	parameters?: Record<string, string>,
	overwrite: boolean = false,
): Promise<boolean> {
	if (!path) return false;

	for (let i = 0; i < structure.length; ++i) {
		const subPath = parameters
			? MiscUtils.replacePlaceholdersInText(structure[i].path, parameters)
			: structure[i].path;
		const fullPath = FileUtils.formPath([path, subPath]);

		if (structure[i].type == "file") {
			const dir = FileUtils.getPathAndFileName(fullPath).path;
			if (!FileUtils.doesDirectoryExist(dir)) {
				FileUtils.createDirectory(dir, true);
			}

			if (structure[i].content) {
				if (!overwrite && FileUtils.doesFileExist(fullPath)) {
					const shouldOverwrite = await getche(
						`File at '${fullPath}' already exists, overwrite (Y/N)? `,
					);
					if (!shouldOverwrite || shouldOverwrite.trim().toLowerCase() !== "y")
						continue;
				}
				FileUtils.writeTextFile(fullPath, structure[i].content!);
			}
		} else {
			FileUtils.createDirectory(fullPath, true);
		}
	}

	return true;
}

// given a tree-directory structure already exists, prompts the user for content to be put into the files to be copied from clipboard once user is ready
export async function addTreeContentInteractive(
	path: string,
	structure: FileTreeNode[],
	parameters: Record<string, string>,
): Promise<boolean> {
	const cm = new ClipboardManager();
	const logger = new Logger();

	for (let i = 0; i < structure.length; ++i) {
		if (structure[i].type !== "file") continue;

		const subPath = MiscUtils.replacePlaceholdersInText(
			structure[i].path,
			parameters,
		);

		const fullPath = FileUtils.formPath([path, subPath]);

		if (FileUtils.doesFileExist(fullPath)) {
			const shouldOverwrite = await getche(
				`File at '${fullPath}' already exists, overwrite (Y/N)? `,
			);
			if (shouldOverwrite.toLowerCase() !== "y") continue;
		}

		const choice = await getche(
			`File: '${fullPath}'\n\tWhen ready press C else press Enter to skip: `,
		);
		if (choice && choice.trim().toLowerCase() == "c") {
			const content = await cm.paste();
			if (content) {
				FileUtils.writeTextFile(fullPath, content);
				logger.info("written");
			}
		} else {
			logger.info("skipped");
		}
	}

	return true;
}

export function drawFileTree(nodes: FileTreeNode[]): string {
	if (nodes.length === 0) return "";

	const lines: string[] = [];

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		const currentLevel = node.level;

		// Determine if the current node is the last sibling at its depth/parent context
		const isLastChild = isLastSibling(nodes, i);

		if (currentLevel === 0) {
			// Root items do not need leading vertical lines or branches
			lines.push(node.name);
		} else {
			let indent = "";

			// Build vertical guidelines for ancestor levels (from level 1 up to level - 1)
			for (let depth = 1; depth < currentLevel; depth++) {
				const hasMoreSiblingsAtDepth = hasSiblingBelow(nodes, i, depth);
				indent += hasMoreSiblingsAtDepth ? "│   " : "    ";
			}

			// Append appropriate branch symbol
			const branch = isLastChild ? "└── " : "├── ";
			lines.push(
				`${indent}${branch}${node.name}${node.type == "dir" ? "/" : ""}`,
			);
		}
	}

	return lines.join("\n");
}

export function getFileListFromStructure(nodes: FileTreeNode[]): string {
	const list = [];
	for (let i = 0; i < nodes.length; ++i) {
		if (nodes[i].type === "file") {
			list.push(nodes[i].path);
		}
	}
	return list.join("\n");
}

// ------------------------- [private] --------------------------

function isLastSibling(nodes: FileTreeNode[], currentIndex: number): boolean {
	const currentLevel = nodes[currentIndex].level;

	for (let j = currentIndex + 1; j < nodes.length; j++) {
		const nextLevel = nodes[j].level;

		// Higher level (numerically smaller) means we exited this parent's scope
		if (nextLevel < currentLevel) return true;

		// Same level found means another sibling exists
		if (nextLevel === currentLevel) return false;
	}

	return true; // Reached end of tree without finding another sibling
}

function hasSiblingBelow(
	nodes: FileTreeNode[],
	currentIndex: number,
	targetDepth: number,
): boolean {
	for (let j = currentIndex + 1; j < nodes.length; j++) {
		const level = nodes[j].level;

		if (level < targetDepth) return false;
		if (level === targetDepth) return true;
	}

	return false;
}
