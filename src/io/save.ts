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

import * as IOUtils from "./io.js";

export class SaveDirectoryUI extends IOUtils.ConsoleUI {
	errorMissingParameter(param: string): void {
		if (IOUtils.QUIET_MODE) return;

		super.errorMissingParameter(param);
		console.log(`Usage:`);
		IOUtils.printIndented(`bscaff -k <key> --save-dir <path> [options]`);
		console.log(`\nExample:`);
		IOUtils.printIndented(
			`bscaff -k react-app --save-dir ~/projects/my-react-app`,
		);
		console.log(`\n${IOUtils.ERROR_FOOTER}\n`);
	}

	errorDuplicateKey(key: string): void {
		if (IOUtils.QUIET_MODE) return;

		super.errorDuplicateKey(key);
		console.log(`To resolve:`);
		IOUtils.printBullet(
			`Delete existing key and retry: bscaff -k ${key} --delete && bscaff -k ${key} --save-dir <path> [options]`,
		);
		IOUtils.printBullet(`Save with a different key\n`);
	}

	errorTriggerScriptsMissing(scriptType: "pre" | "post", path: string): void {
		if (IOUtils.QUIET_MODE) return;

		super.errorTriggerScriptsMissing(scriptType, path, "recall");
		IOUtils.printIndented(`Operation aborted. No snapshot was taken.`);
		console.log(`\nTo resolve:`);
		IOUtils.printBullet(`Verify the script path exists`);
		IOUtils.printBullet(`Omit the hook option\n`);
	}

	successSnapshotTaken(
		key: string,
		size: string | null,
		fileCount: number,
		dirCount: number,
		desc: string | null = null,
	): void {
		if (IOUtils.QUIET_MODE) return;

		super.successSnapshotTaken(
			key,
			size,
			fileCount,
			dirCount,
			desc,
			"Directory",
		);
	}
}
