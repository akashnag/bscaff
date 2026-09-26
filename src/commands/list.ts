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
import { ListSnapshotsIO } from "../io/list.js";
import { Logger } from "../io/logger.js";
import { SnapshotType } from "../types/types.js";
import * as SnapshotUtils from "../utils/snapshot.js";
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

	if (!store.doesKeyExist(key)) {
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

	if (!store.doesKeyExist(key)) {
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
		SnapshotUtils.getFileUnderSnippet(key, record.structure.filename!),
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
	// TODO: add code

	return true;
}

// lists down all snapshots by type
export async function list(
	key: string | undefined,
	sType: string | undefined,
	tags: string | undefined,
	relPath: string | undefined,
): Promise<boolean> {
	const io = new ListSnapshotsIO();
	const store = await Store.create();

	if (key && sType) {
		io.errorConflictingArgs("key", "type");
		return false;
	}

	if (key && tags) {
		io.errorConflictingArgs("key", "tags");
		return false;
	}

	if (sType && relPath) {
		io.errorConflictingArgs("type", "path");
		return false;
	}

	if (tags && relPath) {
		io.errorConflictingArgs("tags", "path");
	}

	if (!sType && !key && !tags && !relPath) {
		// plain listing of all types of snippets [master]
		return listDBStats(io, store);
	}

	if (sType || tags) {
		if (sType) {
			sType = sType.toLowerCase();
			if (
				["template", "snippet", "tree", "files", "url"].indexOf(sType) == -1
			) {
				io.errorInvalidValue("type", [
					"template",
					"snippet",
					"tree",
					"files",
					"url",
				]);
				return false;
			}
		}

		const snippetTypeMapper: Record<string, SnapshotType> = {
			template: SnapshotType.Template,
			snippet: SnapshotType.Snippet,
			tree: SnapshotType.Tree,
			files: SnapshotType.Files,
			url: SnapshotType.URL,
		};

		const data = store.getRawListFiltered(
			sType ? [snippetTypeMapper[sType]] : undefined,
			tags ? tags.split(",") : undefined,
		);

		if (data.length == 0) {
			io.warnNoItemsFound(sType, tags);
			return false;
		}

		io.listSnapshots(sType, tags, data);
	}

	return true;
}

function listDBStats(io: ListSnapshotsIO, store: Store): boolean {
	const data = store.getList();
	io.showSnapshotInventory(data);
	return true;
}
