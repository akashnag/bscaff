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

import { FileTreeNode, Template } from "../types/types.js";
import { Config } from "./config.js";
import * as FileUtils from "./files.js";
import * as MiscUtils from "./misc.js";
import {
	drawFileTree,
	extractStructureFromASCIITree,
	extractStructureFromDirectory,
} from "./tree.js";

// reads a template file and returns its contents as a Template
export async function readTemplateFile(filePath: string): Promise<Template> {
	const content = await FileUtils.readTextFile(filePath);
	const blankTemplate = {
		structure: null,
		parameters: null,
		triggers: {},
	};

	if (!content) {
		return blankTemplate;
	}

	const contentLines = content.split(/\r?\n/);
	const parts: Record<string, any> = {};
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

			if (sectionType == "Content") {
				parts[header] = sectionContent; // remove sectionType so that we can find by file-path in O(1)
			} else if (sectionType == "PreScript" || sectionType == "PostScript") {
				parts[sectionType] = {
					fileType: header,
					content: sectionContent,
				};
			} else {
				parts[`${sectionType}|${header}`] = sectionContent;
			}

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
	const structure = extractStructureFromASCIITree(parts["Tree|Tree"]).structure; // ignore parameters because it is not the complete set (i.e. doesnt contain parameters in file contents)

	if (!structure) return blankTemplate;

	let triggers: Template["triggers"] = {};

	if (parts["PreScript"]) {
		triggers["preScript"] = {
			content: parts["PreScript"].content,
			fileType: parts["PreScript"].fileType,
		};
	}

	if (parts["PostScript"]) {
		triggers["postScript"] = {
			content: parts["PostScript"].content,
			fileType: parts["PostScript"].fileType,
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
	const nodes: FileTreeNode[] | null = (
		await extractStructureFromDirectory(dirPath, withContent)
	).structure;

	if (!nodes) return false;

	const fileTreeASCII = await drawFileTree(nodes);
	if (!fileTreeASCII) return false;

	function createFileSection(
		sectionType: string,
		header: string,
		content: string,
	): string {
		const count = MiscUtils.countLines(content);
		return `!<${sectionType}>[${header}:${count}]\n${content}\n\n`;
	}

	let content: string = "";
	let parameters: Set<string> = new Set<string>();

	content += createFileSection(
		"Header",
		"Header",
		`Version=${Config.TEMPLATE_FILE_VERSION}`,
	);
	content += createFileSection("Tree", "Tree", fileTreeASCII);

	if (preExtractScriptPath) {
		preExtractScriptPath = FileUtils.resolvePath(preExtractScriptPath);
		const scriptFileType = FileUtils.getFileType(preExtractScriptPath);
		const scriptContent = await FileUtils.readTextFile(preExtractScriptPath);
		if (!scriptContent) return false;

		content += createFileSection("PreScript", scriptFileType, scriptContent);
	}

	if (postExtractScriptPath) {
		postExtractScriptPath = FileUtils.resolvePath(postExtractScriptPath);
		const scriptFileType = FileUtils.getFileType(postExtractScriptPath);
		const scriptContent = await FileUtils.readTextFile(postExtractScriptPath);
		if (!scriptContent) return false;

		content += createFileSection("PreScript", scriptFileType, scriptContent);
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

export function verifyTemplateStructure(content: string): boolean {
	// TODO: add code

	return true;
}
