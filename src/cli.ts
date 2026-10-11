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

import { Command, Option } from "commander";
import pkg from "../package.json" with { type: "json" };
import * as CreateCommands from "./commands/create-commands.js";
import * as ExtractSnapshotCommands from "./commands/extract-commands.js";
import * as ListSnapshotCommands from "./commands/list-commands.js";
import * as SnapshotManagementCommands from "./commands/misc-commands.js";
import * as SaveSnapshotCommands from "./commands/save-commands.js";
import * as TemplateCommands from "./commands/template-commands.js";
import { Config } from "./core/config.js";
import { ConsoleIO } from "./io/io.js";
import * as FileUtils from "./utils/file-utils.js";

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
			.option(
				"--data-dir <path>",
				"Path to use for saving all data; data will be saved under <path>/.bscaff",
			)

			// pre-hook
			.hook("preAction", (thisCommand, actionCommand) => {
				const options = thisCommand.opts();

				if (options.quiet) {
					ConsoleIO.setSilentMode();
				}
				if (options.dataDir) {
					const sPath = FileUtils.resolvePath(options.dataDir);
					if (!FileUtils.doesDirectoryExist(sPath)) {
						ConsoleIO.log(
							"ERROR: specified data directory does not exist, resorting to defaults",
						);
					} else {
						Config.setStoragePath(sPath);
						ConsoleIO.log(
							`Using storage directory: ${sPath}/${Config.DIRECTORY_NAME}\n`,
						);
					}
				}
			})
			.action(async (options: Record<string, any>, command: Command) => {
				const retVal = await SaveSnapshotCommands.saveSnippetFromLiveInput(
					options.key,
				);

				if (!retVal) throw new Error();
			});

		this.defineSaveGroup();
		this.defineMiscGroup();
		this.defineListGroup();
		this.defineExtractGroup();
		this.defineCreateGroup();
		this.defineTemplateGroup();

		// ------- parked for future ----
		//this.defineTransformGroup();
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
			[Save directory tree]		-->	bscaff -k react-snapshot --desc "My awesome react app" --tags=react,app save tree ~/projects/my-react-app
			[Save git repo]				-->	bscaff -k test-fork save tree https://github.com/akashnag/bscaff.git --git
		*/
		const saveTreeCommand = saveGroup
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
			[Save snippet from file]	--> bscaff -k react-create-component save snippet ./components/my-component.tsx
			[Save snippet from memory]	--> bscaff -k react-create-component save snippet --type=tsx
		*/
		const saveSnippetCommand = saveGroup
			.command("snippet [path]")
			.description(
				"Save a text/code snippet from a file/clipboard. If flags and path omitted, opens a text-editor for content-input.",
			)
			.option("-c, --clipboard", "Copy from clipboard")
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
					if (options.clipboard || path) {
						retVal = await SaveSnapshotCommands.saveSnippet(
							globalOpts.key,
							parentOpts?.desc,
							parentOpts?.tags,
							options.type,
							options.clipboard,
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
		const saveFilesCommand = saveGroup
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
			[Save link]		--> bscaff -k go-docs save url https://go.dev/doc/
		*/
		const saveURLCommand = saveGroup
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
	}

	private defineMiscGroup(): void {
		/*
		Examples:
			[Open settings for editing]		-->	bscaff settings
		*/
		const settingsCommand = this.program
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
		const updateKeyCommand = updateGroup
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
						newKey,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Update description]	-->	bscaff -k react-project update desc "Generic react project boilerplate"
		*/
		const updateDescriptionCommand = updateGroup
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
		const updateTagsCommand = updateGroup
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
		const updateURLCommand = updateGroup
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
		const updateFileContentCommand = updateGroup
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
		const deleteCommand = this.program
			.command("delete [rel-path]")
			.description("Delete snapshot, or a file under the snapshot")
			.option("-f, --force", "Delete without confirmation")
			.action(
				async (
					relPath: string | undefined,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await SnapshotManagementCommands.deleteSnapshotOrFile(
						globalOpts.key,
						options.force,
						relPath,
					);
					if (!retVal) throw new Error();
				},
			);
	}

	private defineListGroup(): void {
		const searchCommand = this.program
			.command("search")
			.description("Searches for a snapshot with a key similar to one provided")
			.option("--desc", "Description (approximate) to match (in double-quotes)")
			.addOption(
				new Option(
					"--type <snapshot-type>",
					"Filter by snapshot type (exact)",
				).choices(["tree", "snippet", "files", "url", "template"]),
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

		const listCommand = this.program
			.command("list [relative-path]")
			.description("Lists the saved snapshots")
			.addOption(
				new Option(
					"--type <snapshot-type>",
					"Filter by snapshot type (exact)",
				).choices(["tree", "snippet", "files", "url", "template"]),
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
		const copyCommand = this.program
			.command("copy [rel-path]")
			.option(
				"--as-tree",
				"If snapshot is a template or a tree, copy the structure as an ASCII-tree instead of list of file-paths",
			)
			.description(
				"Copy the snippet / file-tree (ASCII) / file-list / URL / file-contents (if path specified) to clipboard",
			)
			.action(
				async (
					relPath: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await ExtractSnapshotCommands.copyToClipboard(
						globalOpts.key,
						options.asTree,
						relPath,
					);
					if (!retVal) throw new Error();
				},
			);

		const openCommand = this.program
			.command("open [rel-path]")
			.description(
				"Opens a URL in the browser; a snippet in a text-editor (read-only), or a file (from tree / template / files) in the default application (read-only)",
			)
			.option(
				"--editor",
				"Force file (from tree / template / files) to be open in the text-editor",
			)
			.option(
				"-c, --command <command>",
				"Use custom app to open file, use double-quotes",
			)
			.action(
				async (
					relPath: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await ExtractSnapshotCommands.openSnapshotReadOnly(
						globalOpts.key,
						options.editor,
						options.command,
						relPath,
					);
					if (!retVal) throw new Error();
				},
			);

		const extractCommand = this.program
			.command("extract <path>")
			.description("Extracts a tree / files / template to the directory path")
			.option(
				"--partial <rel-path>",
				"Extract the snapshot partially under path specified by <rel-path>",
			)
			.option(
				"--dry-run",
				"Do a dry-run without actually performing the extraction",
			)
			.addOption(
				new Option(
					"-e, --if-exists <behaviour>",
					"Behaviour if destination file exists",
				).choices(["overwrite", "fail", "skip", "prompt"]),
			)
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await ExtractSnapshotCommands.extract(
						globalOpts.key,
						options.dryRun,
						options.ifExists,
						options.partial,
						path,
					);
					if (!retVal) throw new Error();
				},
			);
	}

	private defineCreateGroup(): void {
		const createGroup = this.program
			.command("create")
			.description("Creates files and trees from content copied to clipboard");

		const createTreeCommand = createGroup
			.command("tree <to-path>")
			.description(
				"Creates a scaffolding tree (ASCII-art copied to clipboard) into the path specified",
			)
			.addOption(
				new Option(
					"-e, --if-exists <behaviour>",
					"Behaviour if destination file exists",
				).choices(["overwrite", "fail", "skip", "prompt"]),
			)
			.option(
				"--prompt-for-content",
				"Prompts to enter content of each text-file in the tree",
			)
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await CreateCommands.createTreeOnDiskFromClipboard(
						path,
						options.ifExists,
						options.promptForContent,
					);
					if (!retVal) throw new Error();
				},
			);

		const createFileCommand = createGroup
			.command("file <to-path>")
			.description(
				"Creates a file in the path specified from content copied to clipboard",
			)
			.option(
				"-o, --overwrite",
				"Overwrite file in destination without prompting",
			)
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await CreateCommands.createFileOnDiskFromClipboard(
						path,
						options.overwrite,
					);
					if (!retVal) throw new Error();
				},
			);
	}

	private defineTemplateGroup(): void {
		const templateGroup = this.program
			.command("template")
			.description("Save/create/generate templates");

		/*
		Examples:
			[Verify template file]			--> bscaff template verify <path-to-yaml-file>
		*/
		const generateProjectCommand = templateGroup
			.command("generate-project <project-directory>")
			.description("Generates a project directory from a template.")
			.option(
				"--dry-run",
				"Test generate the project without actually creating files",
			)
			.option(
				"--json <var-inputs>",
				"Read variable inputs from JSON content instead of prompting",
			)
			.addOption(
				new Option(
					"-e, --if-exists <behaviour>",
					"Behaviour if destination file exists",
				).choices(["overwrite", "fail", "skip", "prompt"]),
			)
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await TemplateCommands.generateProjectFromTemplate(
						globalOpts.key,
						options.dryRun,
						options.ifExists,
						options.json,
						path,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Verify template file]			--> bscaff template verify <path-to-yaml-file>
		*/
		const verifyTemplateCommand = templateGroup
			.command("verify <path-to-template-directory>")
			.description(
				"Verifies if a template directory and its config file is syntactically correct.",
			)
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await TemplateCommands.verifyTemplate(path);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Save template from zip]			--> bscaff -k my-template template save ./bscaff-react-template.zip --source zip
			[Save template from git repo]		--> bscaff -k my-template template save https://github.com/bscaff/bscaff-react-template.git --source git
		*/
		const saveTemplateCommand = templateGroup
			.command("save <path-to-template>")
			.option(
				"--desc <description>",
				"Brief description of the snapshot (in double-quotes)",
			)
			.option(
				"--tags <list-of-tags>",
				"List of tags (comma-separated, no spaces) associated with this snapshot",
			)
			.addOption(
				new Option("-s, --source <source>", "Type of the path specified")
					.choices(["zip", "git", "dir"])
					.default("dir"),
			)
			.description("Save a bscaff template")
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await TemplateCommands.saveTemplate(
						globalOpts.key,
						options.desc,
						options.tags,
						options.source,
						path,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples:
			[Create template from directory]			--> bscaff -k my-template template create projects/my-react-app
		*/
		const createTemplateCommand = templateGroup
			.command("create <path-to-directory>")
			.description(
				"Create a new bscaff template from a directory (and saves it)",
			)
			.option(
				"--desc <description>",
				"Brief description of the snapshot (in double-quotes)",
			)
			.option(
				"--tags <list-of-tags>",
				"List of tags (comma-separated, no spaces) associated with this snapshot",
			)
			.option("--edit", "Edit the template config file before saving")
			.action(
				async (
					path: string,
					options: Record<string, any>,
					command: Command,
				) => {
					const globalOpts = command.optsWithGlobals();
					const retVal = await TemplateCommands.createTemplateFromDirectory(
						globalOpts.key,
						options.desc,
						options.tags,
						options.edit,
						path,
					);
					if (!retVal) throw new Error();
				},
			);

		/*
		Examples: 
			NOTE: this works only if the template was originally created from a git-repo
			[Update template]		--> bscaff -k my-template template update
		*/
		const updateTemplateCommand = templateGroup
			.command("update")
			.description(
				"Update a saved template from its upstream git repo (if exists)",
			)
			.action(async (options: Record<string, any>, command: Command) => {
				const globalOpts = command.optsWithGlobals();
				const retVal = await TemplateCommands.updateTemplate(globalOpts.key);
				if (!retVal) throw new Error();
			});

		/*
		Examples: 
			NOTE: this works only if the template was originally created from a git-repo
			[Update template-generated project]		--> bscaff -k my-template template update-project projects/my-react-app
		*/
		/*
		// parked for future
		const updateTemplateProjectCommand = templateGroup
			.command("update-project <path-to-project>")
			.description(
				"Updates a project originally created/extracted from a template",
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
		*/
	}

	// -------------------- [future] ------------------------

	/*
	private defineTransformGroup(): void {
		const transformGroup = this.program
			.command("transform")
			.description("Transform external files");

		const insertCommand = transformGroup
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

		const replaceCommand = transformGroup
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

		const trimCommand = transformGroup
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

		const appendCommand = transformGroup
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

		const prependCommand = transformGroup
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
	*/
}
