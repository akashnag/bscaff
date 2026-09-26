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

import {
	ConsoleIO,
	IOHeaderType,
	printBullet,
	printErrorFooter,
	printField,
	printHeader,
	printIndented,
	QUIET_MODE,
} from "./io.js";

export class SaveDirectoryIO extends ConsoleIO {
	errorMissingParameter(param: string): void {
		if (QUIET_MODE) return;

		super.errorMissingParameter(param);
		console.log(`Usage:`);
		printIndented(`bscaff -k <key> save <path> [options]`);
		console.log(`\nExample:`);
		printIndented(`bscaff -k react-app save ~/projects/my-react-app`);
		printErrorFooter();
	}

	errorDuplicateKey(key: string): void {
		if (QUIET_MODE) return;

		super.errorDuplicateKey(key);
		console.log(`To resolve:`);
		printBullet(
			`Delete existing key and retry: bscaff -k ${key} delete && bscaff -k ${key} save <path> [options]`,
		);
		printBullet(`Save with a different key\n`);
	}

	errorTriggerScriptsMissing(scriptType: "pre" | "post", path: string): void {
		if (QUIET_MODE) return;

		super.errorTriggerScriptsMissing(scriptType, path, "recall");
		printIndented(`Operation aborted. No snapshot was taken.`);
		console.log(`\nTo resolve:`);
		printBullet(`Verify the script path exists`);
		printBullet(`Omit the hook option\n`);
	}

	successSnapshotTaken(
		key: string,
		size: string | null,
		fileCount: number,
		dirCount: number,
		desc: string | undefined,
		tags: string[] | undefined,
	): void {
		if (QUIET_MODE) return;

		super.successSnapshotTaken(
			key,
			size,
			fileCount,
			dirCount + 1, // since this is a tree, the root is also to be counted
			desc,
			tags,
			"Tree",
		);
	}
}
