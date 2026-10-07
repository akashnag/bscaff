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

import { token_sort_ratio } from "fuzzball";
import { Store } from "../core/store.js";
import { ListSnapshotsIO } from "../io/list-io.js";
import { SnapshotRecord, SnapshotType } from "../types/types.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TemplateUtils from "../utils/template-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

// --------------------------------------------------------
// bscaff [-k <key>] list [relative-path] [--type <type>] [--tags <tag1,tag2,...tagN>]
// --------------------------------------------------------
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
		io.showSnapshotInventory(store.getList());
		return true;
	}

	if (sType || tags) {
		// validation of sType is handled by Commander

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
			return true; // this is not an error
		}

		await io.listSnapshots(store, sType, tags, data);
	} else if (key) {
		const record = store.fetch(key);
		if (!record) {
			io.errorKeyNotFound(key);
			return false;
		}

		if (relPath) {
			return await displaySnapshotFileOrDirectory(io, key, record, relPath);
		} else {
			return await displaySnapshotInfo(io, key, record);
		}
	}

	return true;
}

// --------------------------------------------------------
// bscaff [-k <approx-key>] search [--desc <approx-desc>] [--type <type>] [--tags <tag1,tag2,...tagN>]
// --------------------------------------------------------
export async function search(
	key: string | undefined,
	desc: string | undefined,
	sType: string | undefined,
	tags: string | undefined,
): Promise<boolean> {
	const io = new ListSnapshotsIO();
	const store = await Store.create();

	// validation of sType is handled by Commander

	const snippetTypeMapper: Record<string, SnapshotType> = {
		template: SnapshotType.Template,
		snippet: SnapshotType.Snippet,
		tree: SnapshotType.Tree,
		files: SnapshotType.Files,
		url: SnapshotType.URL,
	};

	const tagList: string[] = tags ? tags.split(",") : [];
	const snapshotsList = store.getRawListFiltered(
		sType ? [snippetTypeMapper[sType]] : undefined,
		tagList,
	);

	if (!snapshotsList || snapshotsList.length == 0) {
		io.warnNoItemsFound(sType, tags);
		return true; // this is not an error
	}

	const scores = [];
	const filteredList = [];

	for (let i = 0; i < snapshotsList.length; ++i) {
		const record = snapshotsList[i];
		const keyMatchScore = key ? token_sort_ratio(key, record.key) : 1;
		const descMatchScore =
			desc && record.description
				? token_sort_ratio(desc, record.description)
				: 1;
		scores.push({ index: i, score: keyMatchScore + descMatchScore });
	}

	scores.sort((a, b) => b.score - a.score);
	const n = Math.min(10, scores.length);

	for (let i = 0; i < n; ++i) {
		filteredList.push(snapshotsList[scores[i].index]);
	}

	await io.listSnapshots(store, sType, tags, filteredList);
	return true;
}

// -------------------------- [private] -------------------------------

async function displaySnapshotFileOrDirectory(
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
		if (!record.structure) {
			io.errorGeneric("displaySnapshotFileOrDirectory::1");
			return false;
		}

		const index =
			SnapshotUtils.getRecordStructureIndexOfFileOrDirectoryFromRelativePath(
				record,
				relPath,
			);

		if (index < 0) {
			io.errorInvalidFileOrDirectory(key, record, relPath);
			return false;
		}

		const item = record.structure[index];

		if (item.type === "file") {
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
			io.displaySubTreeFromSnapshot(key, record, relPath);
			return true;
		}
	} else {
		io.errorFileOrDirectoryFetchingNotPermittedForSnapshotType(
			key,
			record.type,
			relPath,
		);
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
