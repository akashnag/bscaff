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
import { ConsoleIO, getche } from "../io/io.js";
import { SaveASCIITreeIO } from "../io/save-io.js";
import { FileTreeNode } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as ParamUtils from "../utils/param-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

type overwriteMode = "prompt" | "overwrite" | "fail" | "skip";

// --------------------------------------------------------
// create tree <path> [-e <behaviour>] [--prompt-for-content]
// --------------------------------------------------------
export async function handleCreateTreeOnDiskFromClipboardCommand(
	toPath: string,
	overwriteBehaviour: string | undefined,
	promptForContent: boolean | undefined,
): Promise<boolean> {
	const io = new SaveASCIITreeIO();
	const cm = new ClipboardManager();

	const tree: string = await cm.paste();
	if (!TreeUtils.isValidASCIITree(tree)) {
		io.errorInvalidTree();
		return false;
	}

	let structure: FileTreeNode[] | null = null;
	try {
		({ structure } = TreeUtils.extractStructureFromASCIITree(tree));
	} catch (err: any) {
		io.errorGeneric(
			"createTreeOnDiskFromClipboard: error extracting structure ==> " +
				err.toString(),
		);
		return false;
	}

	if (!structure) {
		io.errorInvalidTree();
		return false;
	}

	toPath = FileUtils.resolvePath(toPath);
	io.infoStartingTreeCreation(toPath);

	const success = createTree(
		toPath,
		structure,
		undefined,
		overwriteBehaviour as overwriteMode,
		promptForContent,
		false,
	);

	if (!success) {
		io.errorCreatingTree();
		return false;
	}

	io.successTreeCreated(toPath);
	return true;
}

// --------------------------------------------------------
// create file <path> [--overwrite]
// --------------------------------------------------------
export async function handleCreateFileOnDiskFromClipboardCommand(
	toPath: string,
	overwrite: boolean | undefined,
): Promise<boolean> {
	const io = new CreateFileIO();
	const cm = new ClipboardManager();

	toPath = FileUtils.resolvePath(toPath);
	const hasFile = FileUtils.doesFileExist(toPath);

	const content = await cm.paste();
	if (!content || content.length == 0) {
		io.errorNoContentForFileCreation(toPath);
		return false;
	}

	if (hasFile && !overwrite) {
		overwrite = await io.promptForFileOverwrite(toPath);

		if (!overwrite) {
			io.warnOperationAborted(toPath);
			return true; // not an error
		}
	}

	const retVal = FileUtils.writeTextFile(toPath, content);
	if (!retVal) {
		io.errorCreatingFile(toPath);
		return false;
	}

	io.successFileCreated(toPath);
	return true;
}

// --------------------------- [helpers] -----------------------------

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
		exclude: Settings.get("exclude") ?? Settings.DEFAULT_SETTINGS.exclude,
		include: Settings.get("include") ?? Settings.DEFAULT_SETTINGS.include,
		templatesSuffix:
			Settings.get("templatesSuffix") ??
			Settings.DEFAULT_SETTINGS.templatesSuffix,
	};

	for (let i = 0; i < structure.length; ++i) {
		const node = structure[i];

		const subPath = parameters
			? ParamUtils.replacePlaceholdersInFilePath(
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
						content =
							await ParamUtils.getModifiedFileContentPostPlaceholderReplacement(
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
