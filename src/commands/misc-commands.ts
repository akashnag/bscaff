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
import { EditSnapshotsIO } from "../io/misc-io.js";
import { SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

// --------------------------------------------------------
// settings
// --------------------------------------------------------
export async function handleOpenSettingsForEditingCommand(): Promise<boolean> {
	return MiscUtils.openFileInEditor(Settings.settingsFile);
}

// --------------------------------------------------------
// update key <new-key>
// --------------------------------------------------------
export async function handleUpdateSnapshotKeyCommand(
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

// --------------------------------------------------------
// update desc <new-description>
// --------------------------------------------------------
export async function handleUpdateDescriptionCommand(
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

// --------------------------------------------------------
// update tags <tag1,tag2,...tagN>
// --------------------------------------------------------
export async function handleUpdateTagsCommand(
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

// --------------------------------------------------------
// update url <new-url>
// --------------------------------------------------------
export async function handleUpdateURLCommand(
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

// --------------------------------------------------------
// update content [relative-file-path]
// --------------------------------------------------------
export async function handleUpdateFileContentCommand(
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

	if (record.type === SnapshotType.URL) {
		io.errorCannotUpdateURLWithContent(key);
		return false;
	}

	if (record.type === SnapshotType.Snippet) {
		if (relPath) {
			io.warnPathIgnoredForUpdatingSnippet();
		}

		io.warnAboutToEditFileDirectly(key);
		const filePath = SnapshotUtils.getFileUnderSnapshot(
			key,
			record.snippetFileName!,
		);
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
		io.errorInvalidFileOrDirectory(key, record, relPath);
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

// --------------------------------------------------------
// delete [relative-file-path]
// --------------------------------------------------------
export async function handleDeleteSnapshotOrFileCommand(
	key: string | undefined,
	forceDelete: boolean | undefined,
	relPath: string | undefined,
): Promise<boolean> {
	const io = new EditSnapshotsIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();

	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const record = store.fetch(key);
	if (!record) {
		io.errorFetchingSnapshot(key);
		return false;
	}

	switch (record.type) {
		case SnapshotType.Snippet:
		case SnapshotType.URL:
			if (relPath) {
				io.errorFileOrDirectoryDeletionUnsupported(key, record.type);
				return false;
			}

			if (
				forceDelete ||
				(await io.promptForSnapshotDeletion(key, record.type))
			) {
				if (!store.delete(key)) {
					io.errorDeletingSnapshot(key);
					return false;
				}
			}
			break;

		case SnapshotType.Files:
		case SnapshotType.Tree:
			let success = false;
			if (relPath) {
				if (!record.structure) {
					io.errorGeneric("deleteSnapshotOrFile::1");
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

				if (
					forceDelete ||
					(await io.promptForSnapshotDeletion(key, record.type))
				) {
					success = store.deletePartial(key, relPath);
				}
			} else {
				if (
					forceDelete ||
					(await io.promptForSnapshotDeletion(key, record.type, relPath))
				) {
					success = store.delete(key);
				}
			}

			if (!success) {
				if (relPath) {
					io.errorDeletingSnapshotPartial(key, relPath);
				} else {
					io.errorDeletingSnapshot(key);
				}
				return false;
			}
			break;

		case SnapshotType.Template:
			if (relPath) {
				io.errorInvalidOption("rel-path");
				return false;
			}

			if (
				forceDelete ||
				(await io.promptForSnapshotDeletion(key, record.type))
			) {
				if (!store.delete(key)) {
					io.errorDeletingSnapshot(key);
					return false;
				}
			}
			break;
	}

	store.update();

	if (relPath) {
		io.successFileOrDirectoryDeleted(key, relPath);
	} else {
		io.successSnapshotDeleted(key);
	}
	return true;
}
