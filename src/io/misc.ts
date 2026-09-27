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

import { SnapshotType } from "../types/types.js";
import { ConsoleIO } from "./io.js";

export class EditSnapshotsIO extends ConsoleIO {
	errorRenamingKey(oldKey: string, newKey: string): void {
		// TODO: add code
	}

	successKeyRenamed(oldKey: string, newKey: string): void {
		// TODO: add code
	}

	errorUpdatingDescription(key: string, oldDesc: string | undefined): void {
		// TODO: add code
	}

	successDescriptionUpdated(key: string, newDesc: string): void {
		// TODO: add code
	}

	errorUpdatingTags(key: string, oldTags: string[] | undefined): void {
		// TODO: add code
	}

	successTagsUpdated(key: string, newTags: string[]): void {
		// TODO: add code
	}

	errorUpdatingURL(key: string, oldURL: string | undefined): void {
		// TODO: add code
	}

	successURLUpdated(key: string, newURL: string): void {
		// TODO: add code
	}

	warnAboutToEditFileDirectly(
		key: string,
		relPath: string | undefined = undefined,
	): void {
		// TODO: add code
	}

	successFileContentUpdated(key: string, relPath: string): void {
		// TODO: add code
	}

	errorEditingFile(key: string, relPath: string | undefined = undefined): void {
		// TODO: add code
	}

	errorCannotUpdateURLWithContent(key: string): void {
		// TODO: add code, ask to use bscaff -k <key> update url <new-url> instead
	}

	warnPathIgnoredForUpdatingSnippet(): void {
		// TODO: add code
	}

	errorPathRequiredForUpdatingContent(key: string): void {
		// TODO: add code
	}

	errorDeletingSnapshot(key: string): void {
		// TODO: add code
	}

	successSnapshotDeleted(key: string): void {
		// TODO: add code
	}

	errorFileDeletionUnsupported(key: string, sType: SnapshotType): void {
		// TODO: add code
	}

	errorDeletingFile(key: string, relPath: string): void {
		// TODO: add code
	}

	successFileDeleted(key: string, relPath: string): void {
		// TODO: add code
	}
}
