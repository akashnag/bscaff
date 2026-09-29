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
import { Config } from "../core/config.js";
import { Settings } from "../core/settings.js";
import { CreateTreeIO } from "../io/create-io.js";
import { ConsoleIO, getche, prompt } from "../io/io.js";
import { FileTreeNode } from "../types/types.js";
import * as FileUtils from "./file-utils.js";
import * as MiscUtils from "./misc-utils.js";
import * as ParamUtils from "./param-utils.js";

// converts an ASCII-art file-tree to FileTreeNode[]
export function extractStructureFromASCIITree(tree: string): {
	structure: FileTreeNode[] | null;
	parameters: string[] | null;
	stats: { fileCount: number; dirCount: number } | undefined;
} {
	if (!isValidASCIITree(tree))
		return { structure: null, parameters: null, stats: undefined };

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

		const params = ParamUtils.getParametersFromText(name);
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

export function isValidASCIITree(tree: string): boolean {
	if (!tree || typeof tree !== "string") return false;

	const chars = {
		branch: "├",
		node: "─",
		comment: "#",
		lastNode: "└",
		trunk: "│",
	};

	const illegalChars = [
		"<",
		">",
		":",
		'"',
		"|",
		"?",
		"*",
		"\0",
		...Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)),
	];

	const lines = tree.split("\n").filter((line) => line.trim().length > 0);
	if (lines.length === 0) return false;

	let treeLineCount = 0;
	let maxSeenLevel = -1;
	let nodeCount = 0;

	for (let i = 0; i < lines.length; i++) {
		let line = lines[i];

		// Strip comments
		const commentIdx = line.indexOf(chars.comment);
		if (commentIdx >= 0) {
			line = line.substring(0, commentIdx);
		}

		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.endsWith(chars.trunk)) continue;

		let level = 0;
		let name = "";
		let hasBranchChar = false;

		const isRoot =
			trimmed[0] !== chars.branch &&
			trimmed[0] !== chars.node &&
			trimmed[0] !== chars.lastNode &&
			trimmed[0] !== chars.trunk;

		if (isRoot) {
			// First line can be a root directory (e.g., "my-project/")
			name = trimmed.endsWith("/") ? trimmed.slice(0, -1).trim() : trimmed;
			level = 0;
		} else {
			hasBranchChar = true;
			let counter = 0;

			for (let j = 0; j < line.length; ++j) {
				const char = line[j];
				if (
					char === chars.branch ||
					char === chars.lastNode ||
					char === chars.trunk
				) {
					counter = 1;
				} else if (char === " " || char === chars.node) {
					++counter;
					if (counter === 3) {
						counter = 0;
						++level;
					}
				} else {
					name = line.substring(j).trim();
					break;
				}
			}
		}

		// Clean trailing folder slashes
		if (name.endsWith("/")) {
			name = name.slice(0, -1).trim();
		}

		// Node name must exist and be free of illegal filename characters
		if (name.length === 0) return false;
		if (illegalChars.some((char) => name.includes(char))) return false;

		// Tree structure continuity check: level cannot jump deeper by more than +1
		if (nodeCount > 0 && level > maxSeenLevel + 1) {
			return false;
		}

		if (hasBranchChar) {
			treeLineCount++;
		}

		maxSeenLevel = Math.max(maxSeenLevel, level);
		nodeCount++;
	}

	// Must have at least 1 valid node
	if (nodeCount === 0) return false;

	// Single line tree is valid if it's a root folder name
	if (lines.length === 1) return true;

	// Multi-line tree must contain actual branch markers
	return treeLineCount > 0;
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

			const params: string[] = ParamUtils.getParametersFromText(entry.name);

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
					if (content)
						params.push(...ParamUtils.getParametersFromText(content));
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

// creates the file structure on disk (include content if available)
export async function createTree(
	path: string | null,
	structure: FileTreeNode[],
	parameters: Record<string, string> | undefined = undefined,
	overwriteBehaviour: "overwrite" | "fail" | "skip" | "prompt" = "prompt",
	promptForFileContent: boolean = false,
	ignorePromptWhereContentExistsInStructure: boolean = false,
	ioHandler: CreateTreeIO | undefined = undefined,
): Promise<boolean> {
	if (!path) return false;
	if (promptForFileContent && !ioHandler) return false;
	if (overwriteBehaviour === "prompt" && !ioHandler) return false;

	const cm = new ClipboardManager();
	const engine = ParamUtils.createTemplateEngine();

	// TODO: handle exclusions and inclusions in a generic way so that this function can be reused for templates
	const exclusions = Settings.get("excludeFromContentInputPrompt")?.split(";");
	const excludeDirs = Settings.get("excludeDirectories");

	for (let i = 0; i < structure.length; ++i) {
		const subPath = parameters
			? ParamUtils.replacePlaceholdersInText(
					structure[i].path,
					parameters,
					engine,
				)
			: structure[i].path;
		const fullPath = FileUtils.formPath([path, subPath]);

		if (structure[i].type == "file") {
			if (exclusions) {
				let valid = true;
				for (let k = 0; k < exclusions?.length; ++k) {
					if (fullPath.endsWith(exclusions[k])) {
						valid = false;
						break;
					}
				}
				if (!valid) continue;
			}

			const dir = FileUtils.getPathAndFileName(fullPath).path;
			if (!FileUtils.doesDirectoryExist(dir)) {
				FileUtils.createDirectory(dir, true);
			}

			if (FileUtils.doesFileExist(fullPath)) {
				switch (overwriteBehaviour) {
					case "skip":
						if (ioHandler) ioHandler.infoFileSkipped(path, fullPath);
						break;

					case "fail":
						if (ioHandler) ioHandler.infoFileOverwriteAborted(fullPath);
						return false;

					case "prompt":
						if (!ioHandler!.promptOverwriteFile(fullPath)) {
							ioHandler!.infoFileSkipped(path, fullPath);
							continue;
						}
				}
			}

			if (promptForFileContent) {
				let content = null;
				if (ignorePromptWhereContentExistsInStructure && structure[i].content) {
					content = structure[i].content;
				} else {
					content = ioHandler!.promptForFileContent(fullPath, cm);
				}

				if (content) {
					FileUtils.writeTextFile(fullPath, content);
				} else {
					ioHandler!.infoFileSkipped(path, fullPath);
				}
			} else {
				// create blank file
				FileUtils.writeTextFile(fullPath, "");
			}
		} else {
			if (excludeDirs && excludeDirs.includes(structure[i].name)) continue;

			if (!FileUtils.doesDirectoryExist(fullPath)) {
				FileUtils.createDirectory(fullPath, true);
			}
		}
	}

	return true;
}

export function sortTreeStructure(nodes: FileTreeNode[]): FileTreeNode[] {
	// TODO: add code
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
