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

const SYMBOL_INFO: string = "ℹ";
const SYMBOL_ERROR: string = "✖";
const SYMBOL_SUCCESS: string = "✔";
const SYMBOL_WARNING: string = "⚠️";

export const SYMBOL_ELLIPSIS: string = "…";
export const SYMBOL_SEPARATOR: string = "─";
export const SYMBOL_BULLET: string = "•";

const INDENTATION_SIZE: number = 2;
const INDENTATION: string = " ".repeat(INDENTATION_SIZE);
const FIELD_WIDTH: number = 10;

const ERROR_FOOTER: string = "Run `bscaff --help` for all available options.";

export var QUIET_MODE: boolean = false;

export enum IOHeaderType {
	SUCCESS = 0,
	ERROR = 1,
	WARNING = 2,
	INFO = 3,
}

function padField(
	s: string,
	width: number = FIELD_WIDTH,
	clipOverflow: boolean = false,
): string {
	if (clipOverflow && s.length > width) {
		return s.substring(0, width - 1) + SYMBOL_ELLIPSIS;
	} else {
		return s.padEnd(width, " ");
	}
}

export function printField(field: string, msg: string): void {
	console.log(chalk.bold(`${INDENTATION}${padField(field)}:`) + ` ${msg}`);
}

export function printHeader(
	msg: string,
	hType: IOHeaderType = IOHeaderType.ERROR,
): void {
	if (hType === IOHeaderType.SUCCESS) {
		console.log(
			chalk.bold(
				chalk.green(
					`${SYMBOL_SUCCESS}${" ".repeat(INDENTATION_SIZE - 1)}${msg}\n`,
				),
			),
		);
	} else if (hType === IOHeaderType.ERROR) {
		console.log(
			chalk.bold(
				chalk.red(`${SYMBOL_ERROR}${" ".repeat(INDENTATION_SIZE - 1)}${msg}\n`),
			),
		);
	} else if (hType === IOHeaderType.WARNING) {
		console.log(
			chalk.bold(
				chalk.yellow(
					`${SYMBOL_WARNING}${" ".repeat(INDENTATION_SIZE - 1)}${msg}\n`,
				),
			),
		);
	} else if (hType === IOHeaderType.INFO) {
		console.log(
			chalk.bold(
				chalk.cyan(`${SYMBOL_INFO}${" ".repeat(INDENTATION_SIZE - 1)}${msg}\n`),
			),
		);
	}
}

export function printBullet(msg: string): void {
	console.log(`${INDENTATION}${SYMBOL_BULLET} ${msg}`);
}

export function printIndented(msg: string): void {
	console.log(`${INDENTATION}${msg}`);
}

export function printErrorFooter(): void {
	console.log(`\n${ERROR_FOOTER}\n`);
}

export function printTable(
	columns: any[],
	data: any[],
	clipOverflow: boolean = true,
): void {
	const defaultColWidth = 15;
	let header = "";
	let separator = "";

	for (let k = 0; k < columns.length; ++k) {
		const w = columns[k].width ?? defaultColWidth;
		header +=
			k == columns.length - 1
				? columns[k].title
				: padField(columns[k].title, w) + " ";
		separator += SYMBOL_SEPARATOR.repeat(w + 1);
	}

	printIndented(separator);
	printIndented(header);
	printIndented(separator);

	if (!data || data.length == 0) {
		printIndented("<No items>\n");
		return;
	}

	let table = "";
	for (let i = 0; i < data.length; ++i) {
		table += (i == 0 ? "" : "\n") + INDENTATION;
		for (let k = 0; k < columns.length; ++k) {
			table +=
				k == columns.length - 1
					? data[i][columns[k].title]
					: padField(
							data[i][columns[k].title],
							columns[k].width ?? defaultColWidth,
							clipOverflow,
						) + " ";
		}
	}

	console.log(table);
	printIndented(separator + "\n");
}

export abstract class ConsoleIO {
	static setSilentMode() {
		QUIET_MODE = true;
	}

	errorMissingParameter(param: string): void {
		if (QUIET_MODE) return;

		printHeader("Missing Required Parameter");
		printField("Error", `Missing required argument <${param}>\n`);
	}

	errorInvalidValue(param: string, expectations: string[]): void {
		if (QUIET_MODE) return;

		printHeader("Invalid Value Specified");
		printField("Error", `Invalid value specified for <${param}>`);
		printField("Expected", expectations.join(" | ") + "\n");
	}

	errorDuplicateKey(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Key Already Exists");
		printField("Key", key);
		printField("Status", `A snapshot with this key already exists.\n`);
	}

	errorSourceDirectoryMissing(path: string): void {
		if (QUIET_MODE) return;

		printHeader("Source Directory Not Found");
		printField("Path", FileUtils.getRelativePath(path));
		printField(
			"Error",
			"Directory does not exist or you may not have read-permissions.",
		);

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
		desc: string | undefined,
		tags: string[] | undefined,
		type: string,
	): void {
		if (QUIET_MODE) return;

		printHeader(`Snapshot saved!`, IOHeaderType.SUCCESS);
		printField("Key", key);
		printField("Type", type);

		if (desc) {
			printField("Desc.", desc);
		}

		if (tags && tags.length > 0) {
			printField("Tags", "#" + tags.join(" #"));
		}

		if (size) {
			printField("Size", size);
		}

		printField("Contents", `${fileCount} files, ${dirCount} directories\n`);
	}

	errorGeneric(info: string): void {
		// TODO: add code
	}

	errorConflictingArgs(arg1: string, arg2: string): void {
		// TODO: add code
	}
}
