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
import { CreateFileIO } from "../io/create-io.js";
import { ConsoleIO, getche } from "../io/io.js";
import { SaveASCIITreeIO } from "../io/save-io.js";
import { FileTreeNode } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

type overwriteMode = "prompt" | "overwrite" | "fail" | "skip";

// --------------------------------------------------------
// create tree <path> [-e <behaviour>] [--prompt-for-content]
// --------------------------------------------------------
export async function createTreeOnDiskFromClipboard(
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

	const { structure } = TreeUtils.extractStructureFromASCIITree(tree);

	if (!structure) {
		io.errorInvalidTree();
		return false;
	}

	toPath = FileUtils.resolvePath(toPath);
	io.infoStartingTreeCreation(toPath);

	const success = TreeUtils.createTree(
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
export async function createFileOnDiskFromClipboard(
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
	}

	if (!overwrite) {
		io.warnOperationAborted(toPath);
		return true; // not an error
	}

	const retVal = FileUtils.writeTextFile(toPath, content);
	if (!retVal) {
		io.errorCreatingFile(toPath);
		return false;
	}

	io.successFileCreated(toPath);
	return true;
}

// --------------------------- [private] -----------------------------
