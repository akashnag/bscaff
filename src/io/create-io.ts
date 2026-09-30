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
import { ConsoleIO } from "./io.js";

export class CreateTreeIO extends ConsoleIO {
	errorInvalidTree(): void {
		// TODO: add code
	}

	errorCreatingTree(): void {
		// TODO: add code
	}

	infoStartingTreeCreation(path: string): void {
		// TODO: add code
	}

	infoTreeNodeProcessed(
		path: string,
		nodeRelativePath: string,
		action: string,
	): void {
		// TODO: add code
	}

	successTreeCreated(path: string): void {
		// TODO: add code
	}

	infoFileSkipped(dirPath: string, filePath: string): void {
		// TODO: add code
	}

	infoFileOverwriteAborted(filePath: string): void {
		// TODO: add code
	}
}

export class CreateFileIO extends CreateTreeIO {
	errorNoContentForFileCreation(filePath: string): void {
		// TODO: add code
	}

	warnOperationAborted(filePath: string): void {
		// TODO: add code
	}

	errorCreatingFile(filePath: string): void {
		// TODO: add code
	}

	successFileCreated(filePath: string): void {
		// TODO: add code
	}
}
