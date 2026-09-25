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
import { Logger } from "../io/logger.js";
import { SnippetType } from "../types/types.js";
import * as SnippetUtils from "../utils/snippet.js";
import * as TreeUtils from "../utils/tree.js";

/*
export async function listAllSnippets(): Promise<boolean> {
	const store = await Store.create();
	const data = store.getList();
	console.table(data);
	return true;
}

export async function listSnippetFiles(key: string): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	const record = store.fetchSnippetRecord(key);
	if (!record) {
		logger.error("can't fetch record");
		return false;
	}

	if (
		record.type === SnippetType.Directory ||
		record.type === SnippetType.MultiFile ||
		record.type === SnippetType.Tree
	) {
		// record.structure.filename will be null here, so iterate over its children
		console.log(TreeUtils.drawSnippetFileTree(record.structure));
	} else if (record.type === SnippetType.File) {
		if (!("filename" in record.structure)) return false;
		console.table([
			{
				key: record.key,
				type: record.type.toString(),
				filename: record.structure.filename,
				updated: record.modifiedAt,
			},
		]);
	} else {
		console.table(store.getList(key));
	}

	return true;
}

export async function displaySnippet(key: string): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	const record = store.fetchSnippetRecord(key);
	if (!record) {
		logger.error("can't fetch record");
		return false;
	}

	if (
		record.type != SnippetType.Text &&
		record.type != SnippetType.File &&
		record.type != SnippetType.URL
	) {
		logger.error("can only use snippets of type text/file/URL");
		return false;
	}

	if (!("filename" in record.structure)) return false;

	const snippet = await FileUtils.readTextFile(
		SnippetUtils.getFileUnderSnippet(key, record.structure.filename!),
	);

	if (!snippet) {
		logger.error("error reading snippet");
		return false;
	}

	console.log(snippet);
	return true;
}
*/

export async function fetch(
	key: string,
	rel_path: string | null,
): Promise<boolean> {
	const logger = new Logger();

	if (!key) {
		logger.error("key not specified");
		return false;
	}

	// TODO: add code

	return true;
}

// lists down all snapshots by type
export async function list(sType: string | null): Promise<boolean> {
	const logger = new Logger();

	if (!sType) {
		logger.error("type not specified");
		return false;
	}

	sType = sType.toLowerCase();
	if (["template", "snippet", "tree", "files", "url"].indexOf(sType) == -1) {
		logger.error("invalid type specified");
		return false;
	}

	const mapper: Record<string, SnippetType[]> = {
		template: [SnippetType.Template],
		snippet: [SnippetType.Text],
		tree: [SnippetType.Tree, SnippetType.Directory],
		files: [SnippetType.File, SnippetType.MultiFile],
		url: [SnippetType.URL],
	};

	const store = new Store();
	const data = store.getRawListByType(mapper[sType]);

	// TODO: add code
	return true;
}
