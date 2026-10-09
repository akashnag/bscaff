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

import { SnapshotRecord, SnapshotType } from "../types/types.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";
import {
	ConsoleIO,
	IOHeaderType,
	printBullet,
	printField,
	printHeader,
	printLinedHeader,
	printPreview,
	printPreviewFileTree,
	printSeparatorLine,
	QUIET_MODE,
	quickConfirm,
} from "./io.js";

export class EditSnapshotsIO extends ConsoleIO {
	errorRenamingKey(oldKey: string, newKey: string): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Rename Key");
		printField("Old Key", oldKey);
		printField("New Key", newKey);
		printField("Error", "Could not rename key in storage.");

		console.log("\nTo resolve:");
		printBullet("Ensure the new key is not already in use");
		printBullet("Verify storage read/write permissions\n");
	}

	successKeyRenamed(oldKey: string, newKey: string): void {
		if (QUIET_MODE) return;

		printHeader("Key Updated Successfully!", IOHeaderType.SUCCESS);
		printField("Old Key", oldKey);
		printField("New Key", newKey);
		console.log("");
	}

	errorUpdatingDescription(key: string, oldDesc: string | undefined): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Update Description");
		printField("Key", key);
		if (oldDesc) {
			printField("Old Desc.", oldDesc);
		}
		printField("Error", "Could not update description for the given snapshot.");

		console.log("\nTo resolve:");
		printBullet("Check read/write permissions for ~/.bscaff storage\n");
	}

	successDescriptionUpdated(key: string, newDesc: string): void {
		if (QUIET_MODE) return;

		printHeader("Description Updated Successfully!", IOHeaderType.SUCCESS);
		printField("Key", key);
		printField("New Desc.", newDesc);
		console.log("");
	}

	errorUpdatingTags(key: string, oldTags: string[] | undefined): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Update Tags");
		printField("Key", key);
		if (oldTags && oldTags.length > 0) {
			printField("Old Tags", "#" + oldTags.join(" #"));
		}
		printField("Error", "Could not update tags for the given snapshot.");

		console.log("\nTo resolve:");
		printBullet("Check read/write permissions for ~/.bscaff storage\n");
	}

	successTagsUpdated(key: string, newTags: string[]): void {
		if (QUIET_MODE) return;

		printHeader("Tags Updated Successfully!", IOHeaderType.SUCCESS);
		printField("Key", key);
		printField("New Tags", "#" + newTags.join(" #"));
		console.log("");
	}

	errorUpdatingURL(key: string, oldURL: string | undefined): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Update URL");
		printField("Key", key);
		if (oldURL) {
			printField("Old URL", oldURL);
		}
		printField("Error", "Could not update URL for the given snapshot.");

		console.log("\nTo resolve:");
		printBullet("Ensure the snapshot exists and is of type URL\n");
	}

	successURLUpdated(key: string, newURL: string): void {
		if (QUIET_MODE) return;

		printHeader("URL Updated Successfully!", IOHeaderType.SUCCESS);
		printField("Key", key);
		printField("New URL", newURL);
		console.log("");
	}

	warnAboutToEditFileDirectly(
		key: string,
		relPath: string | undefined = undefined,
	): void {
		if (QUIET_MODE) return;

		printHeader("Opening File for Editing", IOHeaderType.INFO);
		printField("Key", key);
		if (relPath) {
			printField("File", relPath);
		}
		printField(
			"Info",
			"Opening temporary file in editor. Save and exit your editor when done.\n",
		);
	}

	successFileContentUpdated(key: string, relPath: string): void {
		if (QUIET_MODE) return;

		printHeader("File Content Updated", IOHeaderType.SUCCESS);
		printField("Key", key);
		printField("File", relPath);
		console.log("");
	}

	errorEditingFile(key: string, relPath: string | undefined = undefined): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Edit File");
		printField("Key", key);
		if (relPath) {
			printField("File", relPath);
		}
		printField("Error", "An error occurred while opening or saving the file.");

		console.log("\nTo resolve:");
		printBullet("Ensure your default $EDITOR is configured properly");
		printBullet("Check write permissions for temporary files\n");
	}

	errorCannotUpdateURLWithContent(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Cannot Update URL Content Directly");
		printField("Key", key);
		printField(
			"Error",
			"Direct content updates are not supported for URL snapshots.",
		);

		console.log("\nTo resolve:");
		printBullet(
			`Use 'bscaff -k ${key} update url <new-url>' to update the target URL instead\n`,
		);
	}

	warnPathIgnoredForUpdatingSnippet(): void {
		if (QUIET_MODE) return;

		printHeader("Path Ignored", IOHeaderType.WARNING);
		printField(
			"Warning",
			"Target path argument is ignored when updating a single snippet or file snapshot.\n",
		);
	}

	errorPathRequiredForUpdatingContent(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Target Path Required");
		printField("Key", key);
		printField(
			"Error",
			"A relative target file path must be specified for directory or template snapshots.",
		);

		console.log("\nTo resolve:");
		printBullet(`Inspect snapshot files using: bscaff list -k ${key}`);
		printBullet(
			`Provide the relative file path to edit when running the update command\n`,
		);
	}

	errorDeletingSnapshot(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Delete Snapshot");
		printField("Key", key);
		printField("Error", "Could not remove snapshot record from storage.");

		console.log("\nTo resolve:");
		printBullet("Ensure the key exists and check storage permissions\n");
	}

	successSnapshotDeleted(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Snapshot Deleted Successfully", IOHeaderType.SUCCESS);
		printField("Key", key);
		console.log("");
	}

	errorFileOrDirectoryDeletionUnsupported(
		key: string,
		sType: SnapshotType,
	): void {
		if (QUIET_MODE) return;

		printHeader("Deletion Not Supported for Snapshot Type");
		printField("Key", key);
		printField("Type", String(sType));
		printField(
			"Error",
			`Partial file/directory deletion is not supported for snapshot type '${sType}'.`,
		);

		console.log("\nTo resolve:");
		printBullet(
			"Partial deletions are only supported on Directory or Template snapshot types",
		);
		printBullet(
			`To delete the whole snapshot instead, use: bscaff delete -k ${key}\n`,
		);
	}

	errorDeletingFileOrDirectory(
		key: string,
		relPath: string,
		isFile: boolean,
	): void {
		if (QUIET_MODE) return;

		printHeader(`Failed to Delete ${isFile ? "File" : "Directory"}`);
		printField("Key", key);
		printField(isFile ? "File" : "Directory", relPath);
		printField(
			"Error",
			`Could not remove ${isFile ? "file" : "directory"} from snapshot storage.`,
		);

		console.log("\nTo resolve:");
		printBullet(`Inspect snapshot files using: bscaff list -k ${key}`);
		printBullet("Check write permissions for storage directory\n");
	}

	successFileOrDirectoryDeleted(key: string, relPath: string): void {
		if (QUIET_MODE) return;

		printHeader(`File/Directory Deleted Successfully`, IOHeaderType.SUCCESS);
		printField("Key", key);
		printField("Path", relPath);
		console.log("");
	}

	errorDeletingSnapshotPartial(key: string, relPath: string): void {
		if (QUIET_MODE) return;

		printHeader(`Failed to Delete File/Directory From Snapshot`);
		printField("Key", key);
		printField("Path", relPath);
		printField("Error", `Could not remove file/directory from snapshot.`);

		console.log("\nTo resolve:");
		printBullet(
			`Inspect snapshot files to check if the path is valid, using: bscaff list -k ${key}`,
		);
	}

	async promptForSnapshotDeletion(
		key: string,
		sType: SnapshotType,
		relPath?: string,
	): Promise<boolean> {
		const msg =
			`Delete ` +
			(relPath ? `file/directory [${relPath}] under ` : ``) +
			`${sType}-snapshot <${key}> (Y/N)?`;
		return await quickConfirm(msg, { y: true, n: false }, false);
	}

	errorInvalidFileOrDirectory(
		key: string,
		record: SnapshotRecord,
		relPath: string,
	): void {
		printHeader("Invalid Path Specified");
		printField("Key", key);
		printField("Path", relPath);
		printField("Error", "Invalid/Non-existent path specified.");

		if (record && record.structure) {
			console.log();
			printPreviewFileTree("File Tree", record.structure);
		}

		console.log("\nTo resolve:");
		printBullet(
			"Retry the operation with a correct path by consulting the file-tree above (if available).\n",
		);
	}
}
