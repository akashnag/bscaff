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

import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import chalk from "chalk";
import { ClipboardManager } from "../core/clipboard.js";
import { FileTreeNode, SnapshotRecord } from "../types/types.js";
import * as FileUtils from "../utils/files.js";
import * as MiscUtils from "../utils/misc.js";

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

export async function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({ input, output });
	return (await rl.question(question)).trim();
}

export function getche(question?: string): Promise<string> {
	return new Promise((resolve) => {
		if (question) {
			process.stdout.write(question);
		}

		const { stdin } = process;

		// Enable raw mode to read keypresses immediately without waiting for Enter
		const isRaw = stdin.isRaw;
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding("utf-8");

		const onData = (data: Buffer | string) => {
			const char = data.toString();

			// Handle Ctrl+C (SIGINT) so the process can still be exited
			if (char === "\u0003") {
				process.exit();
			}

			// Restore previous raw mode setting and cleanup event listener
			stdin.setRawMode(isRaw);
			stdin.pause();
			stdin.removeListener("data", onData);

			// Print a newline so subsequent output starts on a fresh line
			process.stdout.write("\n");

			resolve(char);
		};

		stdin.on("data", onData);
	});
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

export function printIndented(msg: string, indented: boolean = true): void {
	const lines = MiscUtils.splitContentByLines(msg);
	for (let i = 0; i < lines.length; ++i) {
		console.log(`${indented ? INDENTATION : ""}${lines[i]}`);
	}
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

export function printSeparatorLine(
	indented: boolean = true,
	width: number = 60,
): void {
	const text = SYMBOL_SEPARATOR.repeat(width);
	printIndented(text, indented);
}

export function printLinedHeader(
	title: string,
	indented: boolean = true,
	width: number = 60,
): void {
	const half = width - title.length - 2;
	const text = `${SYMBOL_SEPARATOR.repeat(half)} ${title} ${SYMBOL_SEPARATOR.repeat(half)}`;
	printIndented(text, indented);
}

export function printCentered(
	text: string,
	indented: boolean = true,
	clip: boolean = true,
	width: number = 60,
): void {
	if (text.length > width) {
		if (clip) {
			text = text.substring(0, width - 1) + SYMBOL_ELLIPSIS;
		}

		printIndented(text, indented);
	} else {
		const n = (width - text.length) / 2;
		printIndented(`${" ".repeat(n)}${text}`, indented);
	}
}

export function printPreview(
	lines: string[],
	indented: boolean = true,
	width: number = 60,
	lineCount: number = 10,
) {
	if (lines.length > lineCount) {
		let firstHalf = "";
		let secondHalf = "";

		for (let i = 0; i < lineCount / 2; ++i) {
			let text = lines[i];
			if (text.length > width)
				text = text.substring(0, width - 1) + SYMBOL_ELLIPSIS;
			firstHalf += "\n" + text;
		}

		for (let i = 0; i < lineCount / 2; ++i) {
			let text = lines[lines.length - i - 1];
			if (text.length > width)
				text = text.substring(0, width - 1) + SYMBOL_ELLIPSIS;
			secondHalf = "\n" + text + secondHalf;
		}

		printIndented(firstHalf.substring(1), indented);
		console.log("\n");
		printCentered(`<${lines.length - lineCount} more lines...>`);
		console.log("\n");
		printIndented(secondHalf.substring(1), indented);
	} else {
		printIndented(lines.join("\n"), indented);
	}
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

	errorSourceFileMissing(path: string): void {
		if (QUIET_MODE) return;

		printHeader("Source File Not Found");
		printField("Path", FileUtils.getRelativePath(path));
		printField(
			"Error",
			"File does not exist or you may not have read-permissions.",
		);

		console.log(`\nTo resolve:`);

		printBullet(`Ensure you have spelt the path correctly and the file exists`);
		printBullet(`Allow read permissions (if file exists)\n`);
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

		if (fileCount + dirCount > 0) {
			printField("Contents", `${fileCount} files, ${dirCount} directories\n`);
		}
	}

	errorGeneric(info: string): void {
		printHeader("Unknown Error Encountered");
		printField("Error", info + "\n");
	}

	errorConflictingArgs(arg1: string, arg2: string): void {
		printHeader("Conflicting Arguments Specified");
		printField("Error", `<${arg1}> and <${arg2}> can not be used together\n`);
	}

	async promptForFileContents(
		cm: ClipboardManager,
		structure: FileTreeNode[],
		updateStructureWithContent: boolean = false,
	): Promise<{ sizeInBytes: number; fileContents: Record<string, string> }> {
		let totalSize = 0;
		const fileContents: Record<string, string> = {};

		for (let i = 0; i < structure.length; ++i) {
			if (structure[i].type == "file") {
				console.log(structure[i].path);
				const choice = await getche(
					"\t" +
						chalk.blue("Press C to copy (from clipboard) or Enter to skip: "),
				);

				if (choice.toLowerCase().trim() == "c") {
					const content = await cm.paste();
					const sizeInBytes = MiscUtils.getSizeOfTextContent(content);
					totalSize += sizeInBytes;
					fileContents[structure[i].path] = content;
					if (updateStructureWithContent) {
						structure[i].content = content;
					}
				}
			}
		}

		return {
			sizeInBytes: totalSize,
			fileContents: fileContents,
		};
	}

	errorKeyNotFound(key: string): void {
		printHeader("Key Not Found");
		printField("Error", `The given key '${key}' was not found in records`);
		console.log(`\nTo resolve:`);
		printIndented(
			"Ensure you have spelt the key correctly, or check the list of valid keys using the command: ",
		);
		printIndented("bscaff list");
	}

	errorInvalidFile(key: string, record: SnapshotRecord, relPath: string): void {
		printHeader("File Does Not Exist");

		printField("Error", "The requested file does not exist");
		printField("Key", key);
		printField("File", relPath);

		console.log("\nTo resolve:");
		printIndented(
			"Check the snapshot structure to ensure you are requesting the correct file path:",
		);
		printIndented(`  bscaff list -k ${key}`);
	}

	errorFetchingSnapshot(key: string): void {
		// TODO: add code
	}
}
