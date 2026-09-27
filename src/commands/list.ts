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
import { SnapshotRecord, SnapshotType } from "../types/types.js";
import * as SnapshotUtils from "../utils/snapshot.js";
import * as TemplateUtils from "../utils/template.js";
import * as TreeUtils from "../utils/tree.js";

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

		await io.listSnapshots(store, sType, tags, data);
	} else if (key) {
		const record = store.fetch(key);
		if (!record) {
			io.errorKeyNotFound(key);
			return false;
		}

		if (relPath) {
			return await displaySnapshotFile(io, key, record, relPath);
		} else {
			return await displaySnapshotInfo(io, key, record);
		}
	}

	return true;
}

// list down number of snapshots by type
function listDBStats(io: ListSnapshotsIO, store: Store): boolean {
	const data = store.getList();
	io.showSnapshotInventory(data);
	return true;
}

async function displaySnapshotFile(
	io: ListSnapshotsIO,
	key: string,
	record: SnapshotRecord,
	relPath: string,
): Promise<boolean> {
	if (
		record.type == SnapshotType.Files ||
		record.type == SnapshotType.Template ||
		record.type == SnapshotType.Tree
	) {
		if (!(await SnapshotUtils.doesSnapshotContainFile(record, relPath))) {
			io.errorInvalidFile(key, record, relPath);
			return false;
		}

		const content = await SnapshotUtils.readContentFromSnapshotFile(
			key,
			relPath,
		);

		if (content) {
			io.displayFileFromSnapshot(key, record, relPath, content);
			return true;
		} else {
			io.errorReadingSnapshotFile(key, relPath);
			return false;
		}
	} else {
		io.errorFileFetchingNotPermittedForSnapshotType(key, record.type, relPath);
		return false;
	}
}

async function displaySnapshotInfo(
	io: ListSnapshotsIO,
	key: string,
	record: SnapshotRecord,
): Promise<boolean> {
	let content = null;

	switch (record.type) {
		case SnapshotType.Files:
		case SnapshotType.Tree:
			await io.listTreeOrFilesInfo(key, record);
			break;

		case SnapshotType.Snippet:
			content = await SnapshotUtils.readContentFromSnapshotFile(
				key,
				record.fileName!,
			);
			if (content) await io.listSnippetInfo(key, record, content);
			break;

		case SnapshotType.Template:
			io.listTemplateInfo(key, record);
			break;

		case SnapshotType.URL:
			io.listURLInfo(key, record);
			break;

		default:
			return false;
	}

	return true;
}
