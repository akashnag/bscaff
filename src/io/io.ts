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
import * as FileUtils from "../utils/files.js";

const SYMBOL_ERROR: string = "✖";
const SYMBOL_SUCCESS: string = "✔";
const SYMBOL_BULLET: string = "•";
const SYMBOL_WARNING: string = "⚠️";
const SYMBOL_SEPARATOR: string = "─";

const INDENTATION: string = "  ";
const FIELD_WIDTH: number = 10;

export const ERROR_FOOTER: string =
	"Run `bscaff --help` for all available options.";
export var QUIET_MODE: boolean = false;

function padField(s: string): string {
	return s.padEnd(FIELD_WIDTH, " ");
}

export function printField(field: string, msg: string) {
	console.log(chalk.bold(`${INDENTATION}${padField(field)}:`) + ` ${msg}`);
}

export function printHeader(msg: string, success: boolean) {
	if (success) {
		console.log(chalk.bold(chalk.green(`${SYMBOL_SUCCESS} ${msg}\n`)));
	} else {
		console.log(chalk.bold(chalk.red(`${SYMBOL_ERROR} ${msg}\n`)));
	}
}

export function printBullet(msg: string) {
	console.log(`${INDENTATION}${SYMBOL_BULLET} ${msg}`);
}

export function printIndented(msg: string) {
	console.log(`${INDENTATION}${msg}`);
}

export abstract class ConsoleUI {
	static setSilentMode() {
		QUIET_MODE = true;
	}

	errorMissingParameter(param: string): void {
		if (QUIET_MODE) return;

		printHeader("Missing Required Parameter", false);
		printField("Error", `Missing required argument <${param}>\n`);
	}

	errorDuplicateKey(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Key Already Exists", false);
		printField("Key", key);
		printField("Status", `A snapshot with this key already exists.\n`);
	}

	errorSourceDirectoryMissing(path: string): void {
		if (QUIET_MODE) return;

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
		if (QUIET_MODE) return;

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
		if (QUIET_MODE) return;

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
