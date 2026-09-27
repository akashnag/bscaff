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
		this.defineTransformGroup();
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
			.command("files <files...>")
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
			[Save template from zip]			--> bscaff -k my-template save template ./bscaff-react-template.zip
			[Save template from git repo]		--> bscaff -k my-template save template https://github.com/bscaff/bscaff-react-template.git --git
		*/
		saveGroup
			.command("template <path-to-zip-OR-git-repo>")
			.option("--git", "Clone template directly from git repo")
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
						options.git,
						path,
					);
					if (!retVal) throw new Error();
				},
			);
	}

	private defineMiscGroup(): void {
		/*
		Examples:
			[Open settings for editing]		-->	bscaff settings
		*/
		const settingsGroup = this.program
			.command("settings")
			.description("Opens bscaff settings for editing")
			.action(async (options: Record<string, any>, command: Command) => {
				const globalOpts = command.optsWithGlobals();
				const retVal =
					await SnapshotManagementCommands.openSettingsForEditing();
				if (!retVal) throw new Error();
			});

		const updateGroup = this.program
			.command("update")
			.description("Update snapshot metadata");

		/*
		Examples:
			[Rename snapshot key]	-->	bscaff -k my-react-snapshot update key react-project
		*/
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
					const retVal = await SnapshotManagementCommands.updateSnapshotKey(
						globalOpts.key,
						options.key,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Update description]	-->	bscaff -k react-project update desc "Generic react project boilerplate"
		*/
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
					const retVal = await SnapshotManagementCommands.updateDescription(
						globalOpts.key,
						newDescription,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Update tags]	-->	bscaff -k react-project update tags react,nextjs,typescript
		*/
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
					const retVal = await SnapshotManagementCommands.updateTags(
						globalOpts.key,
						newTags,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Update URL]	-->	bscaff -k github update url https://github.com/
		*/
		updateGroup
			.command("url <new-url>")
			.description("Update the URL")
			.action(
				async (
					newURL: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await SnapshotManagementCommands.updateURL(
						globalOpts.key,
						newURL,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Update snippet]	-->	bscaff -k copyright-text update content
			[Update file]		-->	bscaff -k react-project update content docs/CONTRIBUTING.md
		*/
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
					const retVal = await SnapshotManagementCommands.updateFileContent(
						globalOpts.key,
						relPath,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Delete snapshot]	-->	bscaff -k copyright-text delete
			[Delete file]		-->	bscaff -k react-project delete docs/CONTRIBUTING.md
		*/
		const deleteGroup = this.program
			.command("delete [rel-path]")
			.description("Delete snapshot, or a file under the snapshot")
			.action(
				async (
					relPath: string | undefined,
					options: Record<string, any>,
					command: Command,
				) => {
					// TODO: add option --force, else prompt user before deleting
					const globalOpts = command.optsWithGlobals();
					const retVal = await SnapshotManagementCommands.deleteSnapshotOrFile(
						globalOpts.key,
						relPath,
					);
					if (!retVal) throw new Error();
				},
			);
	}

	private defineListGroup(): void {
		const searchGroup = this.program
			.command("search")
			.description("Searches for a snapshot with a key similar to one provided")
			.option("--desc", "Description (approximate) to match (in double-quotes)")
			.option(
				"--type <tree|snippet|files|url|template>",
				"Filter by snapshot type (exact)",
			)
			.option(
				"--tags <list-of-tags>",
				"Filter by tags (exact, separated by commas, no spaces)",
			)
			.action(async (options: Record<string, any>, command: Command) => {
				const globalOpts = command.optsWithGlobals();
				const retVal = await ListSnapshotCommands.search(
					globalOpts.key,
					options.desc,
					options.type,
					options.tags,
				);
				if (!retVal) throw new Error();
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
		const copyGroup = this.program
			.command("copy [rel-path]")
			.description(
				"Copy the snippet / file-tree (ASCII) / file-list / url to clipboard / file-contents (if path specified)",
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
			.option(
				"--partial <rel-path>",
				"Extract the snapshot partially under path specified by <rel-path>",
			)
			.option("--overwrite", "Overwrite files in destination without prompting")
			.option(
				"--fail-if-exists",
				"Aborts extraction if the file in destination exists",
			)
			.option(
				"--skip-if-exists",
				"Skip files which exist in destination during extraction",
			)
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

	private defineTransformGroup(): void {
		const transformGroup = this.program
			.command("transform")
			.description("Transform external files");

		const insertGroup = transformGroup
			.command("insert <files...>")
			.option(
				"--before <text>",
				"Inserts the snippet before each occurrence of <text> (in double-quotes)",
			)
			.option(
				"--after <text>",
				"Inserts the snippet after each occurrence of <text> (in double-quotes)",
			)
			.description(
				"Inserts snippets before/after each occurrence of a given text pattern",
			)
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

		const replaceGroup = transformGroup
			.command("replace <files...>")
			.option(
				"--with-snippet <snippet-key>",
				"Replace occurrences of the snippet (under key) with this new snippet text",
			)
			.option(
				"--with-text <text>",
				"Replace occurrences of the snippet (under key) with this new text (within double-quotes)",
			)
			.option(
				"--pattern <text>",
				"Replace occurrences of this pattern text (within double quotes) with the snippet (under key)",
			)
			.option(
				"--regex <text>",
				"Replace occurrences of this regex-pattern (within double-quotes) with the snippet (under key)",
			)
			.option(
				"--comment-block <start,end>",
				"Places the snippet text (if found) under block comments denoted by comment-start and end characters",
			)
			.option(
				"--comment-line <start>",
				"Places each line of the snippet text (if found) under comment specified by comment-start character",
			)
			.description("Replaces text in files")
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

		const trimGroup = transformGroup
			.command("trim <files...>")
			.option("--first <N>", "Delete first N lines from the target files")
			.option("--last <N>", "Delete last N lines from the target files")
			.description("Delete first/last N lines from the target files")
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

		const appendGroup = transformGroup
			.command("append <files...>")
			.option("--trim-first <N>", "Delete first N lines from the target files")
			.option("--trim-last <N>", "Delete last N lines from the target files")
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

		const prependGroup = transformGroup
			.command("prepend <files...>")
			.option("--trim-first <N>", "Delete first N lines from the target files")
			.option("--trim-last <N>", "Delete last N lines from the target files")
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
