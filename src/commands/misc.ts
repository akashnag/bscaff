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
import { Store } from "../core/store.js";
import { Logger } from "../io/logger.js";
import { EditSnapshotsIO } from "../io/misc.js";
import { SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/files.js";
import * as MiscUtils from "../utils/misc.js";
import * as SnapshotUtils from "../utils/snapshot.js";
import * as TreeUtils from "../utils/tree.js";
/*
export async function deleteSnippet(key: string): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	if (SnapshotUtils.deleteSnapshotDirectory(key)) {
		store.delete(key);
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

	if (!store.doesKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	if (SnapshotUtils.renameSnapshotDirectory(key, newKey)) {
		store.renameKey(key, newKey);
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

	const { structure, parameters } =
		TreeUtils.extractStructureFromASCIITree(tree);

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
			await TreeUtils.addTreeContentInteractive(path, structure, paramValues);
		}

		logger.success("tree created");
		return true;
	}

	return false;
}
*/

export async function openSettingsForEditing(): Promise<boolean> {
	return MiscUtils.openFileInEditor(Settings.settingsFile);
}

export async function updateSnapshotKey(
	key: string | undefined,
	newKey: string,
): Promise<boolean> {
	const store = await Store.create();
	const io = new EditSnapshotsIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	if (store.doesKeyExist(newKey)) {
		io.errorDuplicateKey(key);
		return false;
	}

	const retVal = store.renameKey(key, newKey);
	if (!retVal) {
		io.errorRenamingKey(key, newKey);
		return false;
	}

	store.update();
	io.successKeyRenamed(key, newKey);

	return true;
}

export async function updateDescription(
	key: string | undefined,
	desc: string,
): Promise<boolean> {
	const store = await Store.create();
	const io = new EditSnapshotsIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const retVal = store.updateDescription(key, desc);
	if (!retVal) {
		io.errorUpdatingDescription(key, store.fetch(key)?.description);
		return false;
	}

	store.update();
	io.successDescriptionUpdated(key, desc);

	return true;
}

export async function updateTags(
	key: string | undefined,
	tags: string,
): Promise<boolean> {
	const store = await Store.create();
	const io = new EditSnapshotsIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const tagList = tags.split(",");
	const retVal = store.updateTags(key, tagList);
	if (!retVal) {
		io.errorUpdatingTags(key, store.fetch(key)?.tags);
		return false;
	}

	store.update();
	io.successTagsUpdated(key, tagList);

	return true;
}

export async function updateURL(
	key: string | undefined,
	url: string,
): Promise<boolean> {
	const store = await Store.create();
	const io = new EditSnapshotsIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const retVal = store.updateURL(key, url);
	if (!retVal) {
		io.errorUpdatingURL(key, store.fetch(key)?.urlContent);
		return false;
	}

	store.update();
	io.successURLUpdated(key, url);

	return true;
}

export async function updateFileContent(
	key: string | undefined,
	relPath: string | undefined,
): Promise<boolean> {
	const store = await Store.create();
	const io = new EditSnapshotsIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const record = store.fetch(key);
	if (!record) {
		io.errorFetchingSnapshot(key);
		return false;
	}

	if (record.type == SnapshotType.URL) {
		io.errorCannotUpdateURLWithContent(key);
		return false;
	}

	if (record.type == SnapshotType.Snippet) {
		if (relPath) {
			io.warnPathIgnoredForUpdatingSnippet();
		}

		io.warnAboutToEditFileDirectly(key);
		const filePath = SnapshotUtils.getFileUnderSnapshot(key, record.fileName!);
		const retVal = MiscUtils.openFileInEditor(filePath);

		if (!retVal) {
			io.errorEditingFile(key);
			return false;
		}

		return true;
	}

	if (!relPath) {
		io.errorPathRequiredForUpdatingContent(key);
		return false;
	}

	const hasFile = SnapshotUtils.doesSnapshotContainFile(record, relPath);
	if (!hasFile) {
		io.errorInvalidFile(key, record, relPath);
		return false;
	}

	io.warnAboutToEditFileDirectly(key, relPath);
	const filePath = SnapshotUtils.getFileUnderSnapshot(key, relPath);
	const retVal = MiscUtils.openFileInEditor(filePath);

	if (!retVal) {
		io.errorEditingFile(key, relPath);
		return false;
	}

	io.successFileContentUpdated(key, relPath);
	return true;
}

export async function deleteSnapshotOrFile(
	key: string | undefined,
	relPath: string | undefined,
): Promise<boolean> {
	const store = await Store.create();
	const io = new EditSnapshotsIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const record = store.fetch(key);
	if (!record) {
		io.errorFetchingSnapshot(key);
		return false;
	}

	if (!relPath) {
		if (!store.delete(key)) {
			io.errorDeletingSnapshot(key);
			return false;
		}

		io.successSnapshotDeleted(key);
		return true;
	}

	if (record.type == SnapshotType.Snippet || record.type == SnapshotType.URL) {
		io.errorFileDeletionUnsupported(key, record.type);
		return false;
	}

	const hasFile = await SnapshotUtils.doesSnapshotContainFile(record, relPath);
	if (!hasFile) {
		io.errorInvalidFile(key, record, relPath);
		return false;
	}

	const retVal = SnapshotUtils.deleteFileUnderSnapshot(store, key, relPath);
	if (!retVal) {
		io.errorDeletingFile(key, relPath);
		return false;
	}

	io.successFileDeleted(key, relPath);
	return true;
}
