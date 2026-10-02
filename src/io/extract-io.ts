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
import { SnapshotType } from "../types/types.js";
import * as IOUtils from "./io.js";
import { ConsoleIO, printIndented } from "./io.js";

/*
export class CopySnapshotIO extends ConsoleIO {
	successSnapshotCopied(key: string, sType: SnapshotType): void {
		// TODO: add code
	}
}

export class OpenSnapshotIO extends ConsoleIO {
	errorOpeningURL(browser: string | null, url: string | undefined): void {
		// TODO: add code
	}
}

export class ExtractSnapshotIO extends ConsoleIO {
	errorExtractionUnsupported(sType: SnapshotType): void {
		// TODO: add code
	}

	infoFileCreate(fPath: string): void {
		// TODO: add code
	}

	infoFileCreateSkipPostPrompt(): void {
		// TODO: add code
	}

	infoFileCreateOverwritePostPrompt(): void {
		// TODO: add code
	}

	infoFileCreateSkip(fPath: string): void {
		// TODO: add code
	}

	infoFileCreateFail(fPath: string): void {
		// TODO: add code
	}

	infoFileCreateOverwrite(fPath: string): void {
		// TODO: add code
	}

	infoDirectoryCreate(tPath: string): void {
		// TODO: add code
	}

	infoDirectoryCreateSkip(tPath: string): void {
		// TODO: add code
	}
}
*/

export class CopySnapshotIO extends ConsoleIO {
	successSnapshotCopied(key: string, sType: SnapshotType): void {
		if (IOUtils.QUIET_MODE) return;

		IOUtils.printHeader("Copied to Clipboard", IOUtils.IOHeaderType.SUCCESS);
		IOUtils.printField("Key", key);
		IOUtils.printField("Type", String(sType));
		IOUtils.printField(
			"Status",
			"Snapshot content successfully copied to clipboard.\n",
		);
	}
}

export class OpenSnapshotIO extends ConsoleIO {
	errorOpeningURL(browser: string | null, url: string | undefined): void {
		if (IOUtils.QUIET_MODE) return;

		IOUtils.printHeader("Failed to Open URL");
		if (url) {
			IOUtils.printField("URL", url);
		}
		if (browser) {
			IOUtils.printField("Browser", browser);
		}
		IOUtils.printField(
			"Error",
			"Unable to launch default browser or requested application to open URL.",
		);

		console.log("\nTo resolve:");
		IOUtils.printBullet(
			"Ensure the URL scheme is valid (e.g. http:// or https://)",
		);
		IOUtils.printBullet(
			"Verify your system default browser or specified browser is installed\n",
		);
	}
}

export class ExtractSnapshotIO extends ConsoleIO {
	errorExtractionUnsupported(sType: SnapshotType): void {
		if (IOUtils.QUIET_MODE) return;

		IOUtils.printHeader("Extraction Not Supported");
		IOUtils.printField("Type", String(sType));
		IOUtils.printField(
			"Error",
			`Extraction is not supported for snapshots of type '${sType}'.`,
		);

		console.log("\nTo resolve:");
		IOUtils.printBullet(
			"Extraction is designed for directories, templates, snippets, or file snapshots\n",
		);
	}

	infoFileCreate(fPath: string): void {
		if (IOUtils.QUIET_MODE) return;

		const tag = chalk.bgGreen.black.bold(" CREATE ");
		printIndented(`${tag} ${fPath}`);
	}

	infoFileCreateSkipPostPrompt(): void {
		if (IOUtils.QUIET_MODE) return;

		const tag = chalk.bgYellow.black.bold(" SKIP ");
		printIndented(`${tag} Skipping file overwrite as requested.\n`);
	}

	infoFileCreateOverwritePostPrompt(): void {
		if (IOUtils.QUIET_MODE) return;

		const tag = chalk.bgCyan.black.bold(" OVERWRITE ");
		printIndented(`${tag} Overwriting file as confirmed.\n`);
	}

	infoFileCreateSkip(fPath: string): void {
		if (IOUtils.QUIET_MODE) return;

		const tag = chalk.bgYellow.black.bold(" SKIP ");
		printIndented(`${tag} ${fPath}`);
	}

	infoFileCreateFail(fPath: string): void {
		if (IOUtils.QUIET_MODE) return;

		IOUtils.printHeader("File Already Exists");
		IOUtils.printField("File", fPath);
		IOUtils.printField(
			"Error",
			"Target destination file already exists and operation was set to fail on collision.",
		);

		console.log("\nTo resolve:");
		IOUtils.printBullet("Remove or rename the existing file before extracting");
		IOUtils.printBullet(
			"Or allow file overwriting by setting the appropriate CLI flag\n",
		);
	}

	infoFileCreateOverwrite(fPath: string): void {
		if (IOUtils.QUIET_MODE) return;

		const tag = chalk.bgCyan.black.bold(" OVERWRITE ");
		printIndented(`${tag} ${fPath}`);
	}

	infoDirectoryCreate(tPath: string): void {
		if (IOUtils.QUIET_MODE) return;

		const tag = chalk.bgGreen.black.bold(" CREATE ");
		printIndented(`${tag} ${tPath}/`);
	}

	infoDirectoryCreateSkip(tPath: string): void {
		if (IOUtils.QUIET_MODE) return;

		const tag = chalk.bgYellow.black.bold(" SKIP ");
		printIndented(`${tag} ${tPath}/`);
	}
}
