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
import { Settings } from "../core/settings.js";
import { ExtractSnapshotIO } from "../io/extract-io.js";
import { SaveASCIITreeIO } from "../io/save-io.js";
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

// converts a directory path to FileTreeNode[], does not include the root-folder name itself as one of the entries
export async function extractStructureFromDirectory(
	dirPath: string,
	options: { exclude?: string[]; include?: string[] },
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

			// Check if file or folder should be excluded using the helper
			if (ParamUtils.shouldFileOrDirectoryBeExcluded(relativePath, options)) {
				continue;
			}

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
				await traverse(fullPath, level + 1);
			} else if (entry.isFile()) {
				const fileSize = FileUtils.getFileSizeInBytes(fullPath) ?? 0;

				++stats.fileCount;
				stats.sizeInBytes += fileSize;

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
					sizeInBytes: fileSize,
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

export function getFileListFromStructure(nodes: FileTreeNode[]): string {
	const list = [];
	for (let i = 0; i < nodes.length; ++i) {
		if (nodes[i].type === "file") {
			list.push(nodes[i].path);
		}
	}
	return list.join("\n");
}

export function getSubTreeInfo(
	nodes: FileTreeNode[],
	relPath: string,
): {
	size: { dirCount: number; fileCount: number };
	tree: string;
	nodes: FileTreeNode[];
} {
	let fileCount = 0,
		dirCount = 0;
	const subNodes = [];

	for (let i = 0; i < nodes.length; ++i) {
		if (FileUtils.isPathChild(relPath, nodes[i].path, nodes[i].type)) {
			subNodes.push(nodes[i]);
			if (nodes[i].type === "dir") ++dirCount;
			else ++fileCount;
		}
	}

	return {
		size: { fileCount, dirCount },
		tree: drawFileTree(subNodes),
		nodes: subNodes,
	};
}

// ---------------------- Tree ordering and drawing ---------------------

export function sortTreeStructure(nodes: FileTreeNode[]): FileTreeNode[] {
	return [...nodes].sort((a, b) => {
		// Normalize paths: remove leading slashes and split by '/'
		const segsA = a.path.replace(/^\//, "").split("/").filter(Boolean);
		const segsB = b.path.replace(/^\//, "").split("/").filter(Boolean);

		const minLen = Math.min(segsA.length, segsB.length);

		for (let i = 0; i < minLen; i++) {
			const segA = segsA[i];
			const segB = segsB[i];

			if (segA !== segB) {
				// If we are at the end of A's path, A is the parent folder of B -> A comes first
				const isEndOfA = i === segsA.length - 1;
				const isEndOfB = i === segsB.length - 1;

				// Determine if segA / segB represent directories at this depth level
				const isDirA = !isEndOfA || a.type === "dir";
				const isDirB = !isEndOfB || b.type === "dir";

				// Directories come before files at the same level
				if (isDirA !== isDirB) {
					return isDirA ? -1 : 1;
				}

				// Otherwise sort alphabetically by segment name
				return segA.localeCompare(segB);
			}
		}

		// Parent path comes before child path (e.g. /src before /src/index.ts)
		return segsA.length - segsB.length;
	});
}

export function drawFileTree(
	rawNodes: FileTreeNode[],
	colored?: boolean,
): string {
	// TODO: add support for colors
	if (rawNodes.length === 0) return "";

	const nodes = sortTreeStructure(rawNodes);
	const lines: string[] = [];

	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		const currentLevel = node.level;

		// Append trailing slash for directories
		const suffix = node.type === "dir" ? "/" : "";

		if (currentLevel === 0) {
			lines.push(`${node.name}${suffix}`);
		} else {
			let indent = "";

			// Build vertical guidelines for ancestor levels (from level 1 up to level - 1)
			for (let depth = 1; depth < currentLevel; depth++) {
				const hasMoreSiblingsAtDepth = hasSiblingBelow(nodes, i, depth);
				indent += hasMoreSiblingsAtDepth ? "│   " : "    ";
			}

			const isLastChild = isLastSibling(nodes, i);
			const branch = isLastChild ? "└── " : "├── ";
			lines.push(`${indent}${branch}${node.name}${suffix}`);
		}
	}

	return lines.join("\n");
}

// ------------------------- [private] --------------------------

function isLastSibling(nodes: FileTreeNode[], currentIndex: number): boolean {
	const currentLevel = nodes[currentIndex].level;

	for (let j = currentIndex + 1; j < nodes.length; j++) {
		const nextLevel = nodes[j].level;

		// Ascended to a parent or higher level ancestor -> no more siblings at currentLevel
		if (nextLevel < currentLevel) return true;

		// Found another item at the exact same depth -> sibling exists
		if (nextLevel === currentLevel) return false;
	}

	return true;
}

function hasSiblingBelow(
	nodes: FileTreeNode[],
	currentIndex: number,
	targetDepth: number,
): boolean {
	for (let j = currentIndex + 1; j < nodes.length; j++) {
		const level = nodes[j].level;

		// Skip deeper items nested within the current ancestor scope
		if (level > targetDepth) continue;

		// Exact match at target depth means a sibling/continuation exists below
		if (level === targetDepth) return true;

		// Ascended above the target depth -> current target ancestor tree has ended
		if (level < targetDepth) return false;
	}

	return false;
}
