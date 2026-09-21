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

import { Command } from "commander";
import pkg from "../package.json" with { type: "json" };
import * as ListSnippet from "./commands/list.js";
import * as MiscSnippetManagement from "./commands/misc.js";
import * as RecallSnippet from "./commands/recall.js";
import * as SaveSnippet from "./commands/save.js";
import { Config } from "./utils/config.js";
import { Logger } from "./utils/logger.js";
import * as MiscUtils from "./utils/misc.js";

export class CLI {
	// shared Commander object
	private readonly program: Command;

	// constructor to initialize Commander
	constructor() {
		this.program = new Command();
		this.defineArgs();
	}

	// define the command line args we accept
	private defineArgs(): void {
		this.program
			.name("bscaff")
			.description(pkg.description)
			.version(pkg.version)

			.option("-k, --key <key>", "key for the snippet")
			.option(
				"--desc <description>",
				"description of the snippet (in double-quotes)",
			)

			.option(
				"--save-dir <path>",
				"saves a snapshot of the directory specified by path",
			)
			.option(
				"--create-template <path>",
				"saves a snapshot of the directory as a template file in the current directory (named after key)",
			)
			.option(
				"--create-template-with-content <path>",
				"saves a snapshot of the directory as a template file in the current directory (named after key) preserving file contents",
			)

			.option("--save-multi <files...>", "saves a snapshot of the files listed")
			.option(
				"--save-text <file>",
				"saves a snapshot of the text contained in the file",
			)
			.option("--save-file <file>", "saves a snapshot of the file")
			.option(
				"--save-input [file_type]",
				"saves a snapshot given as input, file_type is the extension (without dot)",
			)
			.option("--save-url <url>", "saves a URL")
			.option("--save-git <repo_url>", "saves a template from a git repo")
			.option(
				"--save-tree [template_file]",
				"saves a project scaffolding tree from either a bscaff-template or from clipboard (e.g. generated from LLM tools)",
			)

			.option(
				"-d, --display [relative_path]",
				"display the contents of the saved text/file",
			)
			.option(
				"-x, --extract <path>",
				"extracts a saved snapshot to the specified path",
			)
			.option(
				"--create-tree <path>",
				"creates a project scaffolding tree directly from clipboard (e.g. generated from LLM tools)",
			)
			.option(
				"--create-tree-with-content <path>",
				"creates a project scaffolding tree directly from clipboard (e.g. generated from LLM tools) with contents of each file prompted",
			)

			.option("-c, --copy", "copies a saved snapshot to clipboard")
			.option("-e, --edit", "opens a saved file/text for editing")
			.option(
				"-o, --open",
				"opens the saved URL in the browser OR open saved text/file in editor (read-only)",
			)
			.option(
				"-a, --append <path...>",
				"adds the text of a saved snapshot to the end of the file(s) specified by path",
			)
			.option(
				"-p, --prepend <path...>",
				"adds the text of a saved snapshot to the beginning of the file(s) specified by path",
			)

			.option(
				"--overwrite",
				"force overwrite if destination file/directory exists",
			)
			.option(
				"--pre-extract <path-to-script-file>",
				"executes this script before extracting a directory/git-template",
			)
			.option(
				"--post-extract <path-to-script-file>",
				"executes this script after extracting a directory/git-template",
			)

			.option(
				"-l, --list",
				"lists down the structure of the saved snapshot (or the text of the file if path mentioned)",
			)
			.option("-r, --rename <new_key>", "updates a snippet key to the new_key")
			.option("--delete", "removes a snippet from record")

			.option(
				"-q, --quiet",
				"works silently without printing anything to screen",
			)
			.option("-s, --settings", "opens bscaff settings for editing")
			.option("-h, --help", "displays this help");
	}

	// display to the user the command-line flags we accept
	showHelp(): void {
		console.log(`${pkg.name} ${pkg.version}`);
		this.program.outputHelp();
	}

	// Parses command line args passed to the program, and calls the appropriate helper function to perform the task
	async parseArgsAndExecute(args: string[]): Promise<number> {
		const logger = new Logger();

		this.program.parse(args);
		const options = this.program.opts();

		if (options.help || args.length == 2) {
			this.showHelp();
			return 0;
		}

		if (options.quiet) Logger.setSilentMode();

		if (
			(!options.key || options.key === true) &&
			!(options.list || options.settings || options.createTree)
		) {
			logger.error("Missing key");
			return 1;
		}

		let retVal: boolean = true;

		if (options.saveDir) {
			retVal = await SaveSnippet.saveDirectory(
				options.key,
				options.saveDir === true ? null : options.saveDir,
				options.desc,
				!options.preExtract || options.preExtract === true
					? null
					: options.preExtract,
				!options.postExtract || options.postExtract === true
					? null
					: options.postExtract,
			);
		} else if (options.createTemplate || options.createTemplateWithContent) {
			if (options.createTemplate) {
				retVal = await SaveSnippet.createTemplate(
					options.key,
					options.createTemplate === true ? null : options.createTemplate,
					!options.preExtract || options.preExtract === true
						? null
						: options.preExtract,
					!options.postExtract || options.postExtract === true
						? null
						: options.postExtract,
					false,
				);
			} else {
				retVal = await SaveSnippet.createTemplate(
					options.key,
					options.createTemplateWithContent === true
						? null
						: options.createTemplateWithContent,
					!options.preExtract || options.preExtract === true
						? null
						: options.preExtract,
					!options.postExtract || options.postExtract === true
						? null
						: options.postExtract,
					true,
				);
			}
		} else if (options.saveMulti) {
			retVal = await SaveSnippet.saveMultipleFiles(
				options.key,
				options.saveMulti === true ? null : options.saveMulti,
				options.desc,
			);
		} else if (options.saveText) {
			retVal = await SaveSnippet.saveTextFromFile(
				options.key,
				options.saveText === true ? undefined : options.saveText,
				options.desc,
			);
		} else if (options.saveFile) {
			retVal = await SaveSnippet.saveFile(
				options.key,
				options.saveFile === true ? undefined : options.saveFile,
				options.desc,
			);
		} else if (options.saveInput) {
			retVal = await SaveSnippet.saveLiveInput(
				options.key,
				options.saveInput === true ? undefined : options.saveInput,
				options.desc,
			);
		} else if (options.saveUrl) {
			retVal = await SaveSnippet.saveURL(
				options.key,
				options.saveUrl === true ? undefined : options.saveUrl,
				options.desc,
			);
		} else if (options.saveGhTemplate) {
			retVal = await SaveSnippet.cloneGitRepo(
				options.key,
				options.saveGhTemplate === true ? undefined : options.saveGhTemplate,
				options.desc,
				!options.preExtract || options.preExtract === true
					? null
					: options.preExtract,
				!options.postExtract || options.postExtract === true
					? null
					: options.postExtract,
			);
		} else if (options.saveTree) {
			retVal = await SaveSnippet.saveTree(
				options.key,
				options.desc,
				!options.saveTree || options.saveTree === true
					? null
					: options.saveTree,
				!options.preExtract || options.preExtract === true
					? null
					: options.preExtract,
				!options.postExtract || options.postExtract === true
					? null
					: options.postExtract,
			);
		} else if (options.display) {
			retVal = await RecallSnippet.displaySnippet(options.key);
		} else if (options.extract) {
			retVal = await RecallSnippet.extractSnippet(
				options.key,
				options.extract === true ? undefined : options.extract,
				options.overwrite,
			);
		} else if (options.createTree || options.createTreeWithContent) {
			if (options.createTree) {
				retVal = await MiscSnippetManagement.createTreeDirect(
					options.createTree === true ? undefined : options.createTree,
					options.overwrite,
					false,
				);
			} else {
				retVal = await MiscSnippetManagement.createTreeDirect(
					options.createTreeWithContent === true
						? undefined
						: options.createTreeWithContent,
					options.overwrite,
					true,
				);
			}
		} else if (options.copy) {
			retVal = await RecallSnippet.copySnippetToMemory(options.key);
		} else if (options.edit) {
			retVal = await SaveSnippet.editSnippetContent(options.key);
		} else if (options.open) {
			retVal = await RecallSnippet.openSnippet(options.key);
		} else if (options.append) {
			retVal = await RecallSnippet.appendOrPrependToFile(
				options.key,
				"append",
				options.append === true ? [] : options.append,
			);
		} else if (options.prepend) {
			retVal = await RecallSnippet.appendOrPrependToFile(
				options.key,
				"prepend",
				options.prepend === true ? [] : options.prepend,
			);
		} else if (options.list) {
			if (options.key) {
				retVal = await ListSnippet.listSnippetFiles(options.key);
			} else {
				retVal = await ListSnippet.listAllSnippets();
			}
		} else if (options.rename) {
			retVal = await MiscSnippetManagement.renameSnippet(
				options.key,
				options.rename,
			);
		} else if (options.delete) {
			retVal = await MiscSnippetManagement.deleteSnippet(options.key);
		} else if (options.settings) {
			retVal = MiscUtils.openFileInEditor(
				Config.getStoragePath([Config.SETTINGS_FILE]),
			);
			if (retVal) logger.success("settings updated");
		}

		return retVal ? 0 : 1;
	}
}
