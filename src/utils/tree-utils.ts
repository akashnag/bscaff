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
import { CreateFileIO } from "../io/create-io.js";
import { ExtractSnapshotIO } from "../io/extract-io.js";
import { ConsoleIO } from "../io/io.js";
import { SaveASCIITreeIO } from "../io/save-io.js";
import { ExtractTemplateIO } from "../io/template-io.js";
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
// WARNING: only to be used for Tree snapshot type (not Files, Templates)
export async function createTree(
	path: string | null,
	structure: FileTreeNode[],
	parameters: Record<string, any> | undefined = undefined,
	overwriteBehaviour: "overwrite" | "fail" | "skip" | "prompt" = "prompt",
	promptForFileContent: boolean = false,
	ignorePromptWhereContentExistsInStructure: boolean = false,
): Promise<boolean> {
	const ioHandler = new SaveASCIITreeIO();
	const extIO = new ExtractSnapshotIO();

	if (!path) return false;
	if (promptForFileContent && !ioHandler) return false;
	if (overwriteBehaviour === "prompt" && !ioHandler) return false;

	const cm = new ClipboardManager();
	const engine = ParamUtils.createTemplateEngine();
	const options = {
		exclude: Settings.get("exclude") ?? [],
		include: Settings.get("include") ?? [],
		templatesSuffix: Settings.get("templatesSuffix") ?? "",
	};

	for (let i = 0; i < structure.length; ++i) {
		const node = structure[i];

		const subPath = parameters
			? ParamUtils.replacePlaceholdersInFileName(
					node.path,
					parameters,
					options,
					engine,
				)
			: node.path;

		// Skip files/folders that match exclude rules or don't match include rules
		if (ParamUtils.shouldFileOrDirectoryBeExcluded(subPath, options)) {
			continue;
		}

		const fullPath = FileUtils.formPath([path, subPath]);

		if (node.type === "file") {
			const dir = FileUtils.getPathAndFileName(fullPath).path;
			if (!FileUtils.doesDirectoryExist(dir)) {
				FileUtils.createDirectory(dir, true);
			}

			if (FileUtils.doesFileExist(fullPath)) {
				switch (overwriteBehaviour) {
					case "skip":
						if (ioHandler) extIO.infoFileCreateSkip(fullPath);
						continue;

					case "fail":
						if (ioHandler) extIO.infoFileCreateFail(fullPath);
						return false;

					case "prompt":
						if (!(await ioHandler!.promptForFileOverwrite(fullPath))) {
							extIO.infoFileCreateSkipPostPrompt();
							continue;
						}
						break;

					case "overwrite":
						break;
				}
			}

			if (promptForFileContent) {
				let content: string | null = null;
				if (ignorePromptWhereContentExistsInStructure && node.content) {
					content = node.content;
				} else {
					content = await ioHandler!.promptForFileContent(fullPath, cm);
					if (parameters && content) {
						content = await ParamUtils.replacePlaceholdersInFileContent(
							fullPath,
							parameters,
							options,
							engine,
						);
					}
				}

				FileUtils.writeTextFile(fullPath, content ?? "");
			} else {
				// Create file with existing node content or blank
				FileUtils.writeTextFile(fullPath, node.content ?? "");
			}
		} else {
			if (!FileUtils.doesDirectoryExist(fullPath)) {
				FileUtils.createDirectory(fullPath, true);
			}
		}
	}

	return true;
}

export function sortTreeStructure(nodes: FileTreeNode[]): FileTreeNode[] {
	return [...nodes].sort((a, b) => {
		// Sort by hierarchy level ascending (root/higher order first)
		if (a.level !== b.level) {
			return a.level - b.level;
		}

		// Sort directories before files at the same level
		if (a.type !== b.type) {
			return a.type === "dir" ? -1 : 1;
		}

		// Optional: Sort alphabetically by name for deterministic ordering
		return a.name.localeCompare(b.name);
	});
}

// WARNING: use this function only for saving snapshots, never for extracting them
export async function copyTree(
	sourceDir: string,
	destPath: string,
	nodes: FileTreeNode[],
	overwriteBehaviour: "fail" | "prompt" | "skip" | "overwrite" = "prompt",
	io?: ExtractTemplateIO,
): Promise<boolean> {
	try {
		// Resolve source and derive target directory name (e.g., "my-app")
		const absSourceDir = FileUtils.resolvePath(sourceDir);
		const sourceDirName =
			absSourceDir.split(/[/\\]/).filter(Boolean).pop() || "";
		const targetBaseDir = FileUtils.resolvePath(`${destPath}/${sourceDirName}`);

		// Create the target parent directory
		FileUtils.createDirectory(targetBaseDir);

		// Sort nodes by level/path depth to ensure parent directories are created before files
		const sortedNodes = [...nodes].sort((a, b) => a.level - b.level);

		for (const node of sortedNodes) {
			// Build absolute source and destination paths
			const srcNodePath = FileUtils.formPath([absSourceDir, node.path]);
			const destNodePath = FileUtils.formPath([targetBaseDir, node.path]);

			if (node.type === "dir") {
				io?.infoCreateDirectory(destNodePath);
				FileUtils.createDirectory(destNodePath);
				continue;
			}

			// Check if file already exists at destination
			let destExists = false;
			try {
				// If resolve/access check reveals file exists
				destExists = FileUtils.doesFileExist(destNodePath);
			} catch {
				destExists = false;
			}

			if (destExists) {
				switch (overwriteBehaviour) {
					case "fail":
						return false;

					case "skip":
						continue;

					case "prompt": {
						const shouldOverwrite =
							await io?.promptForFileOverwrite(destNodePath);

						if (!shouldOverwrite) {
							continue; // Skip copying if user answers false
						}

						break;
					}

					case "overwrite":
						// Proceed to copy over existing file
						break;
				}
			}

			io?.infoCreateFile(destNodePath);
			FileUtils.copyFile(srcNodePath, destNodePath);
		}

		return true;
	} catch (error) {
		return false;
	}
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
