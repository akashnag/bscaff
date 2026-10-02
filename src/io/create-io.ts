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
import * as FileUtils from "../utils/file-utils.js";
import {
	ConsoleIO,
	IOHeaderType,
	printBullet,
	printField,
	printHeader,
	QUIET_MODE,
} from "./io.js";

export class CreateFileIO extends ConsoleIO {
	errorNoContentForFileCreation(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("No Content Provided");
		printField("File", FileUtils.getRelativePath(filePath));
		printField("Error", "Cannot create file without initial content.\n");
	}

	warnOperationAborted(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("Operation Aborted", IOHeaderType.WARNING);
		printField("File", FileUtils.getRelativePath(filePath));
		printField("Status", "File creation was aborted by the user.\n");
	}

	errorCreatingFile(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Create File");
		printField("File", FileUtils.getRelativePath(filePath));
		printField(
			"Error",
			"Could not create or write content to the target file.",
		);

		console.log("\nTo resolve:");
		printBullet(
			"Ensure you have write permissions for the destination directory",
		);
		printBullet("Check if the path is valid and accessible\n");
	}

	successFileCreated(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("File Created Successfully!", IOHeaderType.SUCCESS);
		printField("Path", FileUtils.getRelativePath(filePath) + "\n");
	}

	infoFileSkipped(targetPath: string, filePath: string): void {
		// TODO: add code
	}

	infoFileOverwriteAborted(filePath: string): void {
		// TODO: add code
	}
}
