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
import ora, { Ora } from "ora";
import { ClipboardManager } from "../core/clipboard.js";
import { Config } from "../core/config.js";
import { Settings } from "../core/settings.js";
import { FileTreeNode } from "../types/types.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";
import {
	ConsoleIO,
	getche,
	IOHeaderType,
	printBullet,
	printErrorFooter,
	printField,
	printHeader,
	printIndented,
	printLinedHeader,
	printSeparatorLine,
	QUIET_MODE,
} from "./io.js";

// --------------------------------------------------------
// save tree [path] [--git]
// --------------------------------------------------------
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
		sType: string = "Tree",
	): void {
		if (QUIET_MODE) return;

		super.successSnapshotTaken(
			key,
			size,
			fileCount,
			dirCount + 1, // since this is a tree, the root is also to be counted
			desc,
			tags,
			sType,
		);
	}
}

export class SaveGitRepoIO extends SaveDirectoryIO {
	private spinner: Ora | null = null;

	cloneStart(localDir: string) {
		if (QUIET_MODE) return;

		this.spinner = ora(
			chalk.bold(chalk.cyan(`Cloning into: `)) + localDir,
		).start();
	}

	cloneComplete() {
		if (QUIET_MODE) return;

		this.spinner!.stop();
	}

	cloneFailed() {
		if (QUIET_MODE) return;

		printHeader("Clone Failed");
		printField("Error", "Could not clone git repo");
		console.log("\nTo resolve:");
		printBullet("Ensure the Git Repo URL is correct");
		printBullet("Check your network connectivity");
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
			"Tree [Git]",
		);
	}
}

export class SaveASCIITreeIO extends SaveDirectoryIO {
	errorInvalidTreeStructure(): void {
		if (QUIET_MODE) return;

		printHeader("Invalid Tree Structure");
		console.log("Expected a tree structure like:");
		console.log(`
			my-app/
			├── public/
			│   ├── favicon.ico
			│   └── index.html
			├── src/
			│   ├── assets/
			│   │   └── logo.svg
			│   ├── components/
			│   │   ├── Button.jsx
			│   │   └── Header.jsx
			│   ├── App.jsx
			│   └── main.jsx
			├── .gitignore
			├── package.json
			└── README.md
		`);
	}

	successSnapshotTaken(
		key: string,
		size: string | null,
		fileCount: number,
		dirCount: number,
		desc: string | undefined,
		tags: string[] | undefined,
		sType?: string,
		structure?: FileTreeNode[],
	): void {
		super.successSnapshotTaken(
			key,
			size,
			fileCount,
			dirCount,
			desc,
			tags,
			sType,
		);

		printLinedHeader("TREE");
		TreeUtils.drawFileTree(structure!);
		printSeparatorLine();
	}
}
// --------------------------------------------------------

// --------------------------------------------------------
// save snippet [path] [--type file-type]
// --------------------------------------------------------
export class SaveSnippetIO extends ConsoleIO {
	errorNoContentFound(fromFile: boolean) {
		if (QUIET_MODE) return;

		printHeader("No Content Found");
		printField(
			"Error",
			`No text content found in ${fromFile ? "file" : "clipboard"}`,
		);
		console.log("\nTo resolve:");
		if (fromFile) {
			printBullet("Copy some text and try again without specifying path");
		}
		printBullet("Specify path to a file which has some text");
	}

	errorLaunchingTextEditor(): void {
		if (QUIET_MODE) return;

		printHeader("Error Launching Text-Editor");
		printField(
			"Error",
			`The text-editor '${Settings.get("textEditor")}' could not be launched`,
		);
		console.log("\nTo resolve:");
		printBullet("Ensure the text-editor is installed");
		printBullet(
			"Change the default text-editor in settings, run: bscaff --settings",
		);
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

		super.successSnapshotTaken(key, size, 0, 0, desc, tags, "Snippet");
	}
}
// --------------------------------------------------------

// --------------------------------------------------------
// save url [url]
// --------------------------------------------------------
export class SaveURLIO extends ConsoleIO {
	errorNoURLFound(fromMemory: boolean) {
		if (QUIET_MODE) return;

		printHeader("No URL Found");
		printField(
			"Error",
			`No URL ${fromMemory ? "was found copied" : "was specified"}`,
		);
		console.log("\nTo resolve:");
		if (fromMemory) {
			printBullet(
				"Copy some link and try again without specifying the url in the arguments",
			);
		}
		printBullet("Specify a valid link in the arguments");
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

		super.successSnapshotTaken(key, null, 0, 0, desc, tags, "URL");
	}
}
// --------------------------------------------------------

// --------------------------------------------------------
// save files <files...>
// --------------------------------------------------------
export class SaveFilesIO extends ConsoleIO {
	// no code required
}
// --------------------------------------------------------
