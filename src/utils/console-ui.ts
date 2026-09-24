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

import * as FileUtils from "./files.js";

const SYMBOL_ERROR: string = "✖";
const SYMBOL_SUCCESS: string = "✔";
const SYMBOL_BULLET: string = "•";
const SYMBOL_WARNING: string = "⚠️";

const INDENTATION: string = "  ";
const FIELD_WIDTH: number = 10;
const ERROR_FOOTER: string = "Run `bscaff --help` for all available options.";

function padField(s: string): string {
	return s.padEnd(FIELD_WIDTH, " ");
}

abstract class ConsoleUI {
	errorMissingParameter(param: string): void {
		console.log(`${SYMBOL_ERROR} Missing Required Parameter`);
		console.log(
			`\n${INDENTATION}${padField("Error")}: Missing required argument <${param}>\n`,
		);
	}

	errorDuplicateKey(key: string): void {
		console.log(`${SYMBOL_ERROR} Key Already Exists`);
		console.log(`\n${INDENTATION}${padField("Key")}: ${key}`);
		console.log(
			`${INDENTATION}${padField("Status")}: A snapshot with this key already exists.\n`,
		);
	}

	errorSourceDirectoryMissing(path: string): void {
		console.log(`${SYMBOL_ERROR} Source Directory Not Found`);
		console.log(
			`\n${INDENTATION}${padField("Path")}: ${FileUtils.getRelativePath(path)}`,
		);
		console.log(
			`${INDENTATION}${padField("Error")}: Directory does not exist or no read-permissions.`,
		);
		console.log(`\nTo resolve:`);
		console.log(
			`${INDENTATION}${SYMBOL_BULLET} Ensure you have spelt the path correctly and the directory exists`,
		);
		console.log(
			`${INDENTATION}${SYMBOL_BULLET} Allow read permissions (if directory exists)\n`,
		);
	}

	errorTriggerScriptsMissing(
		scriptType: "pre" | "post",
		path: string,
		mode: "save" | "recall",
	): void {
		console.log(
			`${SYMBOL_ERROR} Lifecycle Hook Error: ${scriptType == "pre" ? "Pre" : "Post"}-Script Not Found\n`,
		);

		if (mode === "recall") {
			console.log(
				`${INDENTATION}${padField("Phase")}: ${scriptType == "pre" ? "Pre" : "Post"}-scaffold hook (--${scriptType}-script)`,
			);
		}

		console.log(
			`${INDENTATION}${padField("Path")}: ${FileUtils.getRelativePath(path)}`,
		);

		console.log(
			`${INDENTATION}${padField("Status")}: File does not exist or is inaccessible.\n`,
		);
	}

	successSnapshotTaken(
		key: string,
		size: string | null,
		fileCount: number,
		dirCount: number,
		desc: string | null = null,
		type: string,
	): void {
		console.log(`${SYMBOL_SUCCESS} Snapshot saved!`);

		console.log(`\n${INDENTATION}${padField("Key")}: ${key}`);

		console.log(`${INDENTATION}${padField("Type")}: ${type}`);

		if (desc) {
			console.log(`${INDENTATION}${padField("Desc.")}: ${desc}`);
		}

		if (size) {
			console.log(`${INDENTATION}${padField("Size")}: ${size}`);
		}

		console.log(
			`${INDENTATION}${padField("Contents")}: ${fileCount} files, ${dirCount} directories\n`,
		);
	}
}

export class SaveDirectoryUI extends ConsoleUI {
	errorMissingParameter(param: string): void {
		super.errorMissingParameter(param);
		console.log(`Usage:`);
		console.log(`${INDENTATION}bscaff -k <key> --save-dir <path> [options]`);
		console.log(`\nExample:`);
		console.log(
			`${INDENTATION}bscaff -k react-app --save-dir ~/projects/my-react-app`,
		);
		console.log(`\n${ERROR_FOOTER}\n`);
	}

	errorDuplicateKey(key: string): void {
		super.errorDuplicateKey(key);
		console.log(`To resolve:`);
		console.log(
			`${INDENTATION}${SYMBOL_BULLET} Delete existing key and retry: bscaff -k ${key} --delete && bscaff -k ${key} --save-dir <path> [options]`,
		);
		console.log(`${INDENTATION}${SYMBOL_BULLET} Save with a different key\n`);
	}

	errorTriggerScriptsMissing(scriptType: "pre" | "post", path: string): void {
		super.errorTriggerScriptsMissing(scriptType, path, "recall");
		console.log(`${INDENTATION}Operation aborted. No snapshot was taken.`);
		console.log(`\nTo resolve:`);
		console.log(`${INDENTATION}${SYMBOL_BULLET} Verify the script path exists`);
		console.log(`${INDENTATION}${SYMBOL_BULLET} Omit the hook option\n`);
	}

	successSnapshotTaken(
		key: string,
		size: string | null,
		fileCount: number,
		dirCount: number,
		desc: string | null = null,
	): void {
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
