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

import pkg from '../package.json' with { type: 'json' };import { Logger } from './utils/logger.js';
import { RecallSnippet } from './commands/recall.js';
import { MiscSnippetManagement } from './commands/misc.js';

export class CLI {
	private readonly program: Command;

	constructor() {
		this.program = new Command();
		this.defineArgs();
	}

	private defineArgs() {
		this.program
			.name(pkg.name)
			.description(pkg.description)
			.version(pkg.version)

			.option('-k, --key <key>', 'key for the snippet')

			.option('-sd, --save-dir <path>', 'saves a snapshot of the directory specified by path')
			.option('-sm, --save-multi <files...>', 'saves a snapshot of the files listed')
			.option('-st, --save-text <file>', 'saves a snapshot of the text contained in the file')
			.option('-sf, --save-file <file>', 'saves a snapshot of the file')
			.option('-si, --save-input [file_type]', 'saves a snapshot given as input')

			.option('-ep, --extract-to-path <path>', 'extracts a saved snapshot to the specified path')
			.option('-ec, --extract-to-memory', 'copies a saved snapshot to clipboard')
			.option('-a, --append <path>', 'adds the text of a saved snapshot to the end of the file specified by path')
			.option('-p, --prepend <path>', 'adds the text of a saved snapshot to the beginning of the file specified by path')
			.option('-o, --overwrite', 'force overwrite if destination file/directory exists')

			.option('-l, --list [relative_path]', 'lists down the structure of the saved snapshot (or the text of the file if path mentioned)')
			.option('-r, --rename <new_key>', 'updates a snippet key to the new_key')
			.option('-d, --delete', 'removes a snippet from record')

			.option('-q, --quiet', 'works silently without printing anything to screen')
			.option('-h, --help', 'displays this help');
	}

	showHelp(): void {
		console.log(`${pkg.name} ${pkg.version}`);
		this.program.outputHelp();
	}

	async parseArgsAndExecute(args: string[]): Promise<number> {
		this.program.parse(args);
		const options = this.program.opts();

		if(options.help) {
			this.showHelp();
			return 0;
		}

		if(options.quiet) Logger.setSilentMode();

		if(!options.key) {
			Logger.error("Missing key");
			return 1;
		}
		
		let retVal: boolean = true;

		if(options.saveText) {
			retVal = await SaveSnippet.saveTextFromFile(options.key, options.saveText);
		} else if(options.saveFile) {
			retVal = await SaveSnippet.saveFile(options.key, options.saveFile);
		} else if(options.extractToMemory) {
			retVal = await RecallSnippet.copySnippetToMemory(options.key);
		} else if(options.delete) {
			retVal = await MiscSnippetManagement.deleteSnippet(options.key);
		} else if(options.rename) {
			retVal = await MiscSnippetManagement.renameSnippet(options.key, options.rename);
		}

		return retVal ? 0 : 1;
	}
}