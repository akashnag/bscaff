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

import chalk from "chalk";
import * as FileUtils from "./files.js";

const SYMBOL_ERROR: string = "✖";
const SYMBOL_SUCCESS: string = "✔";
const SYMBOL_BULLET: string = "•";
const SYMBOL_WARNING: string = "⚠️";
const SYMBOL_SEPARATOR: string = "─";

const INDENTATION: string = "  ";
const FIELD_WIDTH: number = 10;
const ERROR_FOOTER: string = "Run `bscaff --help` for all available options.";

function padField(s: string): string {
	return s.padEnd(FIELD_WIDTH, " ");
}

function printField(field: string, msg: string) {
	console.log(chalk.bold(`${INDENTATION}${padField(field)}:`) + ` ${msg}`);
}

function printHeader(msg: string, success: boolean) {
	if (success) {
		console.log(chalk.bold(chalk.green(`${SYMBOL_SUCCESS} ${msg}\n`)));
	} else {
		console.log(chalk.bold(chalk.red(`${SYMBOL_ERROR} ${msg}\n`)));
	}
}

function printBullet(msg: string) {
	console.log(`${INDENTATION}${SYMBOL_BULLET} ${msg}`);
}

function printIndented(msg: string) {
	console.log(`${INDENTATION}${msg}`);
}

abstract class ConsoleUI {
	errorMissingParameter(param: string): void {
		printHeader("Missing Required Parameter", false);
		printField("Error", `Missing required argument <${param}>\n`);
	}

	errorDuplicateKey(key: string): void {
		printHeader("Key Already Exists", false);
		printField("Key", key);
		printField("Status", `A snapshot with this key already exists.\n`);
	}

	errorSourceDirectoryMissing(path: string): void {
		printHeader("Source Directory Not Found", false);
		printField("Path", FileUtils.getRelativePath(path));
		printField("Error", "Directory does not exist or no read-permissions.");

		console.log(`\nTo resolve:`);

		printBullet(
			`Ensure you have spelt the path correctly and the directory exists`,
		);
		printBullet(`Allow read permissions (if directory exists)\n`);
	}

	errorTriggerScriptsMissing(
		scriptType: "pre" | "post",
		path: string,
		mode: "save" | "recall",
	): void {
		printHeader(
			`Lifecycle Hook Error: ${scriptType == "pre" ? "Pre" : "Post"}-Script Not Found`,
			false,
		);

		if (mode === "recall") {
			printField(
				"Phase",
				`${scriptType == "pre" ? "Pre" : "Post"}-scaffold hook (--${scriptType}-script)`,
			);
		}

		printField("Path", FileUtils.getRelativePath(path));
		printField("Status", `File does not exist or is inaccessible.\n`);
	}

	successSnapshotTaken(
		key: string,
		size: string | null,
		fileCount: number,
		dirCount: number,
		desc: string | null = null,
		type: string,
	): void {
		printHeader(`Snapshot saved!`, true);
		printField("Key", key);
		printField("Type", type);

		if (desc) {
			printField("Desc.", desc);
		}

		if (size) {
			printField("Size", size);
		}

		printField("Contents", `${fileCount} files, ${dirCount} directories\n`);
	}
}

export class SaveDirectoryUI extends ConsoleUI {
	errorMissingParameter(param: string): void {
		super.errorMissingParameter(param);
		console.log(`Usage:`);
		printIndented(`bscaff -k <key> --save-dir <path> [options]`);
		console.log(`\nExample:`);
		printIndented(`bscaff -k react-app --save-dir ~/projects/my-react-app`);
		console.log(`\n${ERROR_FOOTER}\n`);
	}

	errorDuplicateKey(key: string): void {
		super.errorDuplicateKey(key);
		console.log(`To resolve:`);
		printBullet(
			`Delete existing key and retry: bscaff -k ${key} --delete && bscaff -k ${key} --save-dir <path> [options]`,
		);
		printBullet(`Save with a different key\n`);
	}

	errorTriggerScriptsMissing(scriptType: "pre" | "post", path: string): void {
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
