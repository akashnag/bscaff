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
import { Store } from "../core/store.js";
import * as FileUtils from "../utils/files.js";
import { Logger } from "../utils/logger.js";
import * as MiscUtils from "../utils/misc.js";
import * as SnippetUtils from "../utils/snippet.js";
import * as TreeUtils from "../utils/tree.js";

export async function deleteSnippet(key: string): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	if (SnippetUtils.deleteSnippetDirectory(key)) {
		store.deleteSnippetRecord(key);
	} else {
		return false;
	}

	store.update();
	logger.success("Snippet deleted");
	return true;
}

export async function renameSnippet(
	key: string,
	newKey: string,
): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	if (SnippetUtils.renameSnippetDirectory(key, newKey)) {
		store.renameSnippetKey(key, newKey);
	} else {
		return false;
	}

	store.update();
	logger.success("Snippet renamed");
	return true;
}

export async function createTreeDirect(
	path: string | null = null,
	overwrite: boolean = false,
	withContent: boolean = false,
): Promise<boolean> {
	const logger = new Logger();
	const cm = new ClipboardManager();
	const tree = (await cm.paste()).trim();

	const { structure, parameters } = TreeUtils.extractStructureFromTree(tree);

	if (!structure) {
		logger.error("invalid tree structure");
		return false;
	}

	if (!path) {
		logger.error("path not specified");
		return false;
	}

	path = FileUtils.resolvePath(path);

	let paramValues: Record<string, string> = {};
	if (parameters) {
		paramValues = await MiscUtils.getParameterValuesFromUser(parameters);
	}

	if (await TreeUtils.createTree(path, structure, paramValues, overwrite)) {
		if (withContent) {
			await TreeUtils.addTreeContentInteractive(structure, paramValues);
		}

		logger.success("tree created");
		return true;
	}

	return false;
}
