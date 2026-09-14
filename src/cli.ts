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

import { SaveSnippet } from './commands/save.js';
import { Command } from 'commander';

import pkg from '../package.json' with { type: 'json' };
import { Logger } from './utils/logger.js';
import { RecallSnippet } from './commands/recall.js';
import { MiscSnippetManagement } from './commands/misc.js';
import { Config } from './utils/config.js';
import { MiscUtils } from './utils/misc.js';

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

			.option('-k, --key <key>', 'key for the snippet')
			.option('--desc <description>', 'description of the snippet (in double-quotes)')

			.option('--save-dir <path>', 'saves a snapshot of the directory specified by path')
			.option('--save-multi <files...>', 'saves a snapshot of the files listed')
			.option('--save-text <file>', 'saves a snapshot of the text contained in the file')
			.option('--save-file <file>', 'saves a snapshot of the file')
			.option('--save-input [file_type]', 'saves a snapshot given as input, file_type is the extension (without dot)')
			.option('--save-url <url>', 'saves a URL')
			//.option('--save-gh-template <repo_url>', 'saves a template from github')
			
			.option('-d, --display [relative_path]', 'display the contents of the saved text/file')
			.option('-x, --extract <path>', 'extracts a saved snapshot to the specified path')
			.option('-c, --copy', 'copies a saved snapshot to clipboard')
			.option('-e, --edit', 'opens a saved file/text for editing')
			.option('-o, --open', 'opens the saved URL in the browser OR open saved text/file in editor (read-only)')
			.option('-a, --append <path...>', 'adds the text of a saved snapshot to the end of the file(s) specified by path')
			.option('-p, --prepend <path...>', 'adds the text of a saved snapshot to the beginning of the file(s) specified by path')
			
			.option('--overwrite', 'force overwrite if destination file/directory exists')
			
			.option('-l, --list', 'lists down the structure of the saved snapshot (or the text of the file if path mentioned)')
			.option('-r, --rename <new_key>', 'updates a snippet key to the new_key')
			.option('--delete', 'removes a snippet from record')

			.option('-q, --quiet', 'works silently without printing anything to screen')
			.option('-s, --settings', 'opens bscaff settings for editing')
			.option('-h, --help', 'displays this help');
	}

	// display to the user the command-line flags we accept
	showHelp(): void {
		console.log(`${pkg.name} ${pkg.version}`);
		this.program.outputHelp();
	}

	// Parses command line args passed to the program, and calls the appropriate helper function to perform the task
	async parseArgsAndExecute(args: string[]): Promise<number> {
		this.program.parse(args);
		const options = this.program.opts();

		if(options.help || args.length == 2) {
			this.showHelp();
			return 0;
		}

		if(options.quiet) Logger.setSilentMode();

		if((!options.key || (options.key === true)) && !(options.list || options.settings)) {
			Logger.error("Missing key");
			return 1;
		}
		
		let retVal: boolean = true;

		if(options.saveDir) {
			// TODO: add code

		} else if(options.saveMulti) {
			retVal = await SaveSnippet.saveMultipleFiles(
				options.key,
				options.saveMulti === true ? null : options.saveMulti,
				options.desc
			);
		} else if(options.saveText) {
			retVal = await SaveSnippet.saveTextFromFile(
						options.key, 
						options.saveText === true ? undefined : options.saveText, 
						options.desc
					);
		} else if(options.saveFile) {
			retVal = await SaveSnippet.saveFile(
						options.key, 
						options.saveFile === true ? undefined : options.saveFile,
						options.desc
					);
		} else if(options.saveInput) {
			retVal = await SaveSnippet.saveLiveInput(
						options.key, 
						options.saveInput === true ? undefined : options.saveInput,
						options.desc
					);
		} else if(options.saveUrl) {
			retVal = await SaveSnippet.saveURL(
				options.key, 
				options.saveUrl === true ? undefined : options.saveUrl,
				options.desc
			);
		} else if(options.saveGhTemplate) {
			// TODO: add code
			
		} else if(options.display) {
			retVal = await RecallSnippet.displaySnippet(options.key);
		} else if(options.extract) {
			retVal = await RecallSnippet.extractSnippet(
				options.key,
				options.extract === true ? undefined : options.extract,
				options.overwrite
			);
		} else if(options.copy) {
			retVal = await RecallSnippet.copySnippetToMemory(options.key);
		} else if(options.edit) {
			retVal = await SaveSnippet.editSnippetContent(options.key);
		} else if(options.open) {
			retVal = await RecallSnippet.openSnippet(options.key);
		} else if(options.append) {
			retVal = await RecallSnippet.appendOrPrependToFile(
				options.key,
				"append",
				options.append === true ? [] : options.append
			);
		} else if(options.prepend) {
			retVal = await RecallSnippet.appendOrPrependToFile(
				options.key,
				"prepend",
				options.prepend === true ? [] : options.prepend
			);
		} else if(options.list) {
			if(options.key) {
				retVal = await RecallSnippet.listSnippetFiles(options.key);
			} else {
				retVal = await RecallSnippet.listAllSnippets();
			}
		} else if(options.rename) {
			retVal = await MiscSnippetManagement.renameSnippet(options.key, options.rename);
		} else if(options.delete) {
			retVal = await MiscSnippetManagement.deleteSnippet(options.key);
		} else if(options.settings) {
			retVal = MiscUtils.openFileInEditor(
				Config.getStoragePath([ Config.SETTINGS_FILE ])
			);
			if(retVal) Logger.success("settings updated");
		}

		return retVal ? 0 : 1;
	}
}