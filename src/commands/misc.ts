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

import { Store } from "../core/store.js";
import { Logger } from "../utils/logger.js";
import * as SnippetUtils from "../utils/snippet.js";

export async function deleteSnippet(key: string): Promise<boolean> {
	const store = new Store();
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
	const store = new Store();
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
