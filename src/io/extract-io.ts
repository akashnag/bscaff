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

import * as inquirer from "@inquirer/prompts";
import chalk from "chalk";
import { FileTreeNode, SnapshotRecord, SnapshotType } from "../types/types.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import {
	ConsoleIO,
	IOHeaderType,
	printBullet,
	printField,
	printHeader,
	printIndented,
	printLinedHeader,
	printPreview,
	printPreviewFile,
	printPreviewFileTree,
	printSeparatorLine,
	QUIET_MODE,
} from "./io.js";

export class CopySnapshotIO extends ConsoleIO {
	async successSnapshotCopied(
		key: string,
		sType: SnapshotType,
		record: SnapshotRecord,
		content?: string | FileTreeNode[],
	): Promise<void> {
		if (QUIET_MODE) return;

		printHeader("Copied to Clipboard", IOHeaderType.SUCCESS);
		printField("Key", key);
		printField("Type", String(sType));

		if (sType == SnapshotType.URL) {
			printField("URL", record.urlContent!);
		}

		printField("Status", "Snapshot content successfully copied to clipboard.");

		if (content) {
			console.log();
			if (typeof content === "string") {
				printLinedHeader("Preview", true);
				printPreview(MiscUtils.splitContentByLines(content), true);
				printSeparatorLine(true);
			} else {
				printPreviewFileTree("File Tree", content);
			}
		}

		console.log();
	}
}

export class OpenSnapshotIO extends ConsoleIO {
	errorOpeningURL(browser: string | null, url: string | undefined): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Open URL");
		if (url) {
			printField("URL", url);
		}
		if (browser) {
			printField("Browser", browser);
		}
		printField(
			"Error",
			"Unable to launch default browser or requested application to open URL.",
		);

		console.log("\nTo resolve:");
		printBullet("Ensure the URL scheme is valid (e.g. http:// or https://)");
		printBullet(
			"Verify your system default browser or specified browser is installed\n",
		);
	}

	errorOpeningFileInEditor(): void {
		printHeader("Error Opening File");
		printField(
			"Error",
			"An error was encountered while attempting to open the requested file/snapshot in a text-editor.",
		);
		console.log("\nTo resolve:");
		printBullet(
			"Ensure you have the correct text-editor configured in settings; to check, run: bscaff settings\n",
		);
	}

	errorOpeningFile(): void {
		printHeader("Error Opening File");
		printField(
			"Error",
			"An error was encountered while attempting to open the requested file/snapshot.\n",
		);
	}

	errorExecutingCustomOpenCommand(command: string): void {
		printHeader("Error Executing Command");
		printField("Command", `${command} <file>`);
		printField(
			"Error",
			"An error was encountered while attempting to execute the command.\n",
		);
	}
}

export class ExtractSnapshotIO extends ConsoleIO {
	errorExtractionUnsupported(sType: SnapshotType): void {
		if (QUIET_MODE) return;

		printHeader("Extraction Not Supported");
		printField("Type", String(sType));
		printField(
			"Error",
			`Extraction is not supported for snapshots of type '${sType}'.`,
		);

		console.log("\nTo resolve:");
		printBullet(
			"Extraction is designed for directories, templates, snippets, or file snapshots\n",
		);
	}

	infoFileCreate(fPath: string): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgGreen.black.bold(" CREATE ");
		printIndented(`${tag} ${fPath}`);
	}

	infoFileCreateSkipPostPrompt(): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgYellow.black.bold(" SKIP ");
		printIndented(`${tag} Skipping file overwrite as requested.\n`);
	}

	infoFileCreateOverwritePostPrompt(): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgCyan.black.bold(" OVERWRITE ");
		printIndented(`${tag} Overwriting file as confirmed.\n`);
	}

	infoFileCreateSkip(fPath: string): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgYellow.black.bold(" SKIP ");
		printIndented(`${tag} ${fPath}`);
	}

	infoFileCreateFail(fPath: string): void {
		if (QUIET_MODE) return;

		printHeader("File Already Exists");
		printField("File", fPath);
		printField(
			"Error",
			"Target destination file already exists and operation was set to fail on collision.",
		);

		console.log("\nTo resolve:");
		printBullet("Remove or rename the existing file before extracting");
		printBullet(
			"Or allow file overwriting by setting the appropriate CLI flag\n",
		);
	}

	infoFileCreateOverwrite(fPath: string): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgCyan.black.bold(" OVERWRITE ");
		printIndented(`${tag} ${fPath}`);
	}

	infoDirectoryCreate(tPath: string): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgGreen.black.bold(" CREATE ");
		printIndented(`${tag} ${tPath}/`);
	}

	infoDirectoryCreateSkip(tPath: string): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgYellow.black.bold(" SKIP ");
		printIndented(`${tag} ${tPath}/`);
	}

	successExtractionCompleted(sType: SnapshotType): void {
		if (QUIET_MODE) return;

		printHeader(`${sType} Extracted Successfully!\n`, IOHeaderType.SUCCESS);
	}

	errorUseGenerateFromTemplateInstead(key: string, tPath: string): void {
		if (QUIET_MODE) return;

		printHeader("Extraction Not Supported");
		printField("Error", `Extraction is not supported for Templates.`);

		console.log("\nTo resolve:");
		printBullet(
			`Use generate-project command, run: bscaff -k ${key} template generate ${tPath}\n`,
		);
	}
}
