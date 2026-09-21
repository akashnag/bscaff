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
import { SnippetType } from "../types/types.js";
import { Logger } from "../utils/logger.js";
import * as SnippetUtils from "../utils/snippet.js";
import * as TreeUtils from "../utils/tree.js";

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
