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
import { Logger } from "../io/logger.js";
import {
	DirectoryStructure,
	FileTreeNode,
	SnippetStructure,
	SnippetStructureItemType,
	Template,
} from "../types/types.js";
import { Config } from "./config.js";
import * as FileUtils from "./files.js";
import * as MiscUtils from "./misc.js";

// converts an ASCII-art file-tree to FileTreeNode[]
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

		const params = MiscUtils.getParametersFromText(name);
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

// reads a template file and returns its contents as a Template
export async function readTemplateFile(filePath: string): Promise<Template> {
	const content = await FileUtils.readTextFile(filePath);
	const blankTemplate = {
		structure: null,
		parameters: null,
	};

	if (!content) {
		return blankTemplate;
	}

	const contentLines = content.split(/\r?\n/);
	const parts: Record<string, string> = {};
	let pointer = 0;
	while (pointer < contentLines.length) {
		if (
			contentLines[pointer].startsWith("!<") &&
			contentLines[pointer].endsWith("]")
		) {
			const s = contentLines[pointer];
			const p1 = s.indexOf(">[");
			const p2 = s.lastIndexOf(":");
			const sectionType = s.substring(2, p1);
			const header = s.substring(p1 + 2, p2);
			const count = parseInt(s.substring(p2 + 1, s.length - 1));
			let sectionContent = "";

			for (let i = 0; i < count; ++i) {
				sectionContent += contentLines[pointer + i + 1] + "\n";
			}

			if (sectionType == "Content")
				parts[header] = sectionContent; // remove sectionType so that we can find by file-path in O(1)
			else parts[`${sectionType}|${header}`] = sectionContent;

			pointer += count + 2;
		} else {
			console.log("ERROR");
		}
	}

	const header = parts["Header|Header"].trim().split("\n");
	for (let i = 0; i < header.length; ++i) {
		if (header[i].trim().startsWith("Version=")) {
			const version = header[i].substring(header[i].indexOf("=") + 1).trim();
			if (version != Config.TEMPLATE_FILE_VERSION) return blankTemplate;
		}
	}

	const parameters = JSON.parse(parts["Parameters|Parameters"]);
	const structure = extractStructureFromTree(parts["Tree|Tree"]).structure; // ignore parameters because it is not the complete set (i.e. doesnt contain parameters in file contents)

	if (!structure) return blankTemplate;

	let triggers: Template["triggers"] = undefined;

	if (parts["PreScript"] || parts["PostScript"]) {
		triggers = {
			type: "content",
			preScript: parts["PreScript"] ?? null,
			postScript: parts["PostScript"] ?? null,
		};
	}

	// add content for each file to structure
	for (let i = 0; i < structure.length; ++i) {
		if (parts[structure[i].path]) {
			structure[i].content = parts[structure[i].path];
		}
	}

	return { parameters, structure, triggers };
}

// scans a directory and creates a template file based off it (including file contents optionally)
export async function createTemplateFileFromDirectory(
	dirPath: string,
	targetTemplateFile: string,
	preExtractScriptPath: string | null = null,
	postExtractScriptPath: string | null = null,
	withContent: boolean = false,
): Promise<boolean> {
	const nodes: FileTreeNode[] = await getFileTreeNodesFromDirectory(
		dirPath,
		withContent,
	);

	const fileTreeASCII = await drawSnippetFileTree(nodes);
	if (!fileTreeASCII) return false;

	function createFileSection(
		sectionType: string,
		header: string,
		content: string,
	): string {
		const count = MiscUtils.countLines(content);
		return `!<${sectionType}>[${header}:${count}]\n${content}\n\n`;
	}

	let preScript = null;
	let postScript = null;

	let content: string = "";
	let parameters: Set<string> = new Set<string>();

	content += createFileSection(
		"Header",
		"Header",
		`Version=${Config.TEMPLATE_FILE_VERSION}`,
	);
	content += createFileSection("Tree", "Tree", fileTreeASCII);

	if (preScript) {
		content += createFileSection("PreScript", "PreScript", preScript);
	}

	if (postScript) {
		content += createFileSection("PostScript", "PostScript", postScript);
	}

	if (withContent) {
		for (let i = 0; i < nodes.length; ++i) {
			// extract parameters from filename
			const params: string[] = MiscUtils.getParametersFromText(nodes[i].name);

			if (nodes[i].content) {
				// extract parameters from content
				params.push(...MiscUtils.getParametersFromText(nodes[i].content!));

				content += createFileSection(
					"Content",
					nodes[i].path,
					nodes[i].content!,
				);
			}

			params.forEach((param: string) => {
				parameters.add(param);
			});
		}
	}

	if (parameters.size > 0) {
		content += createFileSection(
			"Parameters",
			"Parameters",
			JSON.stringify(Array.from(parameters)),
		);
	}

	return FileUtils.writeTextFile(targetTemplateFile, content);
}

// creates the file structure on disk (include content if available)
export async function createTree(
	path: string | null,
	structure: FileTreeNode[],
	parameters: Record<string, string>,
	overwrite: boolean = false,
): Promise<boolean> {
	if (!path) return false;

	for (let i = 0; i < structure.length; ++i) {
		const subPath = MiscUtils.replacePlaceholdersInText(
			structure[i].path,
			parameters,
		);
		const fullPath = FileUtils.formPath([path, subPath]);

		if (structure[i].type == "file") {
			const dir = FileUtils.getPathAndFileName(fullPath).path;
			if (!FileUtils.doesDirectoryExist(dir)) {
				FileUtils.createDirectory(dir, true);
			}

			if (structure[i].content) {
				if (!overwrite && FileUtils.doesFileExist(fullPath)) {
					const shouldOverwrite = await MiscUtils.getche(
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
			const shouldOverwrite = await MiscUtils.getche(
				`File at '${fullPath}' already exists, overwrite (Y/N)? `,
			);
			if (shouldOverwrite.toLowerCase() !== "y") continue;
		}

		const choice = await MiscUtils.getche(
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

// given a SnippetStructure or a FileTreeNode[] draws the file tree as ASCII-art and returns as a string
export async function drawSnippetFileTree(
	structure: SnippetStructure | FileTreeNode[],
	prefix: string = "",
	isLast: boolean = true,
	lines: string[] = [],
): Promise<string | null> {
	let struct: SnippetStructure | null = null;

	if (Array.isArray(structure)) {
		struct = (await getDirectoryStructureFromTree(structure)).structure;
	} else {
		struct = structure;
	}

	if (!struct) return null;

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

// ------------------------- [private] -----------------------------

async function getDirectoryStructureFromTree(
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
		const params = MiscUtils.getParametersFromText(node.name);
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

async function getFileTreeNodesFromDirectory(
	dirPath: string,
	readContent: boolean = false,
): Promise<FileTreeNode[]> {
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
			const relativePath = "/" + FileUtils.formRelativePath(dirPath, fullPath);

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

	await traverse(dirPath, 0);
	return nodes;
}
