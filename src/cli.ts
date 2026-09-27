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
import * as ListSnapshotCommands from "./commands/list.js";
import * as SnapshotManagementCommands from "./commands/misc.js";
import * as RecallSnapshotCommands from "./commands/recall.js";
import * as SaveSnapshotCommands from "./commands/save.js";
import { ConsoleIO } from "./io/io.js";
import { Logger } from "./io/logger.js";
import { Config } from "./utils/config.js";
import * as MiscUtils from "./utils/misc.js";

export class CLI {
	// shared Commander object
	public readonly program: Command;

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

			// global flags (in addition to --version, --help)
			.option("-k, --key <key>", "Key for the snapshot")
			.option(
				"-q, --quiet",
				"Works silently without printing anything to screen",
			)

			// pre-hook
			.hook("preAction", (thisCommand, actionCommand) => {
				const options = thisCommand.opts();
				if (options.quiet) {
					Logger.setSilentMode();
					ConsoleIO.setSilentMode();
				}
			});

		this.defineSaveGroup();
		this.defineMiscGroup();
		this.defineListGroup();
		this.defineExtractGroup();
		this.defineCreateGroup();
	}

	private defineSaveGroup(): void {
		const saveGroup = this.program
			.command("save")
			.description("Save snapshots")
			.option(
				"--desc <description>",
				"Brief description of the snapshot (in double-quotes)",
			)
			.option(
				"--tags <list-of-tags>",
				"List of tags (comma-separated, no spaces) associated with this snapshot",
			);

		/*
		Examples:
			[Save directory tree]							-->	bscaff -k react-snapshot --desc --tags=react,app "My awesome react app" save tree ~/projects/my-react-app
			[Save git repo]									-->	bscaff -k test-fork save tree https://github.com/akashnag/bscaff.git --git
		*/
		saveGroup
			.command("tree [dir-path_or_repo-url]")
			.description(
				"Save a snapshot of a directory tree specified by path/git-repo URL",
			)
			.option("--git", "Clone from a git repo")
			.option(
				"--prompt-for-content",
				"Prompt for content of each file (if path omitted)",
			)
			.action(
				async (
					path: string | undefined,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const parentOpts = command.parent?.opts();
					let retVal = true;

					if (!path) {
						retVal = await SaveSnapshotCommands.saveASCIITreeFromClipboard(
							globalOpts.key,
							parentOpts?.desc,
							parentOpts?.tags,
							options.promptForContent,
						);
					} else if (options.git) {
						retVal = await SaveSnapshotCommands.saveGitRepo(
							globalOpts.key,
							parentOpts?.desc,
							parentOpts?.tags,
							path,
						);
					} else {
						retVal = await SaveSnapshotCommands.saveDirectory(
							globalOpts.key,
							parentOpts?.desc,
							parentOpts?.tags,
							path,
						);
					}

					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Save snippet from file]						--> bscaff -k react-create-component save snippet ./components/my-component.tsx
			[Save snippet from memory]						--> bscaff -k react-create-component save snippet --type=tsx
		*/
		saveGroup
			.command("snippet [path/to/file]")
			.description("Save a text/code snippet from a file / clipboard")
			.option("--memory", "Copy from clipboard")
			.option(
				"--type <file-type>",
				"If to be copied from clipboard, this signals the type of the code/text",
			)
			.action(
				async (
					path: string | undefined,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const parentOpts = command.parent?.opts();

					let retVal: boolean = false;
					if (options.memory || path) {
						retVal = await SaveSnapshotCommands.saveSnippet(
							globalOpts.key,
							parentOpts?.desc,
							parentOpts?.tags,
							options.type,
							options.memory,
							path,
						);
					} else {
						retVal = await SaveSnapshotCommands.saveSnippetFromLiveInput(
							globalOpts.key,
							parentOpts?.desc,
							parentOpts?.tags,
							options.type,
						);
					}
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Save files]									--> bscaff -k my-go-package save files ./*.go
			[Save files]									--> bscaff -k my-go-package save files format.go main.go test.go
		*/
		saveGroup
			.command("files <...files>")
			.description("Save one or more files")
			.action(
				async (
					files: string[],
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const parentOpts = command.parent?.opts();
					const retVal = await SaveSnapshotCommands.saveFiles(
						globalOpts.key,
						parentOpts?.desc,
						parentOpts?.tags,
						files,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Save link]										--> bscaff -k go-docs save url https://go.dev/doc/
		*/
		saveGroup
			.command("url [url]")
			.description("Save a web URL/link (from clipboard if URL omitted)")
			.action(
				async (url: string, options: Record<string, any>, command: Command) => {
					const globalOpts = command.optsWithGlobals();
					const parentOpts = command.parent?.opts();
					const retVal = await SaveSnapshotCommands.saveURL(
						globalOpts.key,
						parentOpts?.desc,
						parentOpts?.tags,
						url,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Save template]									--> bscaff -k my-template save template ./my-template.bs_template
		*/
		saveGroup
			.command("template <path/to/template-file>")
			.description("Save a bscaff template")
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const parentOpts = command.parent?.opts();
					const retVal = await SaveSnapshotCommands.saveTemplate(
						globalOpts.key,
						parentOpts?.desc,
						parentOpts?.tags,
						path,
					);
					if (!retVal) throw new Error();
				},
			);
	}

	private defineMiscGroup(): void {
		const settingsGroup = this.program
			.command("settings")
			.description("Opens bscaff settings for editing")
			.action(async (options: Record<string, any>, command: Command) => {
				const globalOpts = command.optsWithGlobals();
				// TODO: add code
			});

		const updateGroup = this.program
			.command("update")
			.description("Update snapshot metadata");

		updateGroup
			.command("key <new-key>")
			.description("Update the snapshot key")
			.action(
				async (
					newKey: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		updateGroup
			.command("desc <new-description>")
			.description("Update the snapshot description (in double quotes)")
			.action(
				async (
					newDescription: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		updateGroup
			.command("tags <new-tags>")
			.description("Update the tags (comma-separated, without spaces)")
			.action(
				async (
					newTags: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		updateGroup
			.command("content [relative-path]")
			.description("Update the content of a snippet / file")
			.action(
				async (
					relPath: string | undefined,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		const deleteGroup = this.program
			.command("delete")
			.description("Delete snapshot")
			.action(async (options: Record<string, any>, command: Command) => {
				const globalOpts = command.optsWithGlobals();
				// TODO: add code
			});
	}

	private defineListGroup(): void {
		const searchGroup = this.program
			.command("search")
			.description("Searches for a snapshot with a key similar to one provided")
			.option("--desc", "Approximate description to match")
			.option(
				"--type <tree|snippet|files|url|template>",
				"Filter by snapshot type",
			)
			.option(
				"--tags <list-of-tags>",
				"Filter by tags (separated by commas, no spaces)",
			)
			.action(async (options: Record<string, any>, command: Command) => {
				const globalOpts = command.optsWithGlobals();
				// TODO: add code
			});

		const listGroup = this.program
			.command("list [relative-path]")
			.description("Lists the saved snapshots")
			.option(
				"--type <tree|snippet|files|url|template>",
				"Filter by snapshot type",
			)
			.option(
				"--tags <list-of-tags>",
				"Filter by tags (separated by commas, no spaces)",
			)
			.action(
				async (
					path: string | undefined,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await ListSnapshotCommands.list(
						globalOpts.key,
						options.type,
						options.tags,
						path,
					);
					if (!retVal) throw new Error();
				},
			);
	}

	private defineExtractGroup(): void {
		const openGroup = this.program
			.command("open [rel-path]")
			.description(
				"Opens a URL in the browser, or a snippet / (template or tree file) in a text-editor (read-only)",
			)
			.action(
				async (
					relPath: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		const extractGroup = this.program
			.command("extract <path>")
			.description("Extracts a tree / files / template to the directory path")
			.option("--overwrite", "Overwrite files in destination without prompting")
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		const appendGroup = this.program
			.command("append <...files>")
			.description("Append the text snippet to the target files")
			.action(
				async (
					files: string[],
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		const prependGroup = this.program
			.command("prepend <...files>")
			.description("Prepend the text snippet to the target files")
			.action(
				async (
					files: string[],
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		const copyGroup = this.program
			.command("copy")
			.description(
				"Copy the snippet / file-tree (ASCII) / file-list / url to clipboard",
			)
			.action(async (options: Record<string, any>, command: Command) => {
				const globalOpts = command.optsWithGlobals();
				// TODO: add code
			});
	}

	private defineCreateGroup(): void {
		const createGroup = this.program
			.command("create")
			.description("Creates templates / scaffolding");

		createGroup
			.command("tree <to-path>")
			.description(
				"Creates a scaffolding tree (ASCII-art copied to clipboard) into the path specified",
			)
			.option(
				"--overwrite",
				"Overwrite files in destination (with blank ones) without prompting",
			)
			.option("--input", "Prompts to enter content of each file in the tree")
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);

		createGroup
			.command("template <from-path>")
			.description(
				"Creates a template from the directory and files contained at the path specified",
			)
			.option(
				"--pre-trigger <path/to/script>",
				"Saves a pre-trigger script to the template, and executes it when template extracted",
			)
			.option(
				"--post-trigger <path/to/script>",
				"Saves a pre-trigger script to the template, and executes it when template extracted",
			)
			.option("--exclude-content", "Exclude file contents from the template")
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					// TODO: add code
				},
			);
	}
}
