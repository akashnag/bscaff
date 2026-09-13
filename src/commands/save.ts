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

import { Store } from '../core/store.js';
import { FileUtils } from '../utils/file-utils.js';
import { Logger } from '../utils/logger.js';
import { SnippetStructure, SnippetStructureItemType, SnippetType } from '../types/types.js';
import { Config } from '../utils/config.js';
import { MiscUtils } from '../utils/misc.js';
import { MiscSnippetManagement } from './misc.js';
import { SnippetUtils } from '../utils/snippet.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

export class SaveSnippet {
	static async saveTextFromFile(key: string, filePath: string, description: string | null = null): Promise<boolean> {
		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		const snippet = await FileUtils.readSnippetFromFile(filePath);
		if(!snippet) {
			Logger.error("cannot read file: ensure it exists, is a text file and you have read permissions");
			return false;
		}

		const fileType = MiscUtils.getFileType(filePath, true, "txt");
		
		SnippetUtils.createSnippetDirectory(key);
		SnippetUtils.writeContentToSnippetFile(snippet, key, `${Config.SNIPPET_TEXT_FILE}${fileType}`);

		const structure: SnippetStructure = {
			filename: `${Config.SNIPPET_TEXT_FILE}${fileType}`,
			type: SnippetStructureItemType.File,
			loc: MiscUtils.countLOC(snippet),
			children: null
		};

		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.Text,
			structure: structure
		});

		store.update();
		Logger.success("snippet saved");
		return true;
	}

	static async saveFile(key: string, filePath: string, description: string | null = null): Promise<boolean> {
		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		if(!FileUtils.doesFileExist(filePath)) {
			Logger.error("file not found");
			return false;
		}

		const filename = FileUtils.getFileNameFromPath(filePath);

		SnippetUtils.createSnippetDirectory(key);
		FileUtils.copyFile(
			filePath,
			Config.getStoragePath([ key, filename ])
		);

		const structure: SnippetStructure = {
			filename: filename,
			type: SnippetStructureItemType.File,
			loc: await MiscUtils.countLOCFromFile(filePath),
			children: null
		};

		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.File,
			structure: structure
		});

		store.update();
		Logger.success("snippet saved");
		return true;
	}

	static async saveLiveInput(key: string, fileType: string = "txt", description: string | null = null): Promise<boolean> {
		const path = MiscUtils.createRandomFileAndOpenInEditor(fileType);
		if(!path) {
			Logger.error("could not launch text editor");
			return false;
		}
		const success = await SaveSnippet.saveTextFromFile(key, path, description);
		if(success) return FileUtils.deleteFile(path);
		return false;
	}

	static async saveURL(key: string, url: string, description: string | null = null): Promise<boolean> {
		if(!url) {
			Logger.error("URL missing");
			return false;
		} else {
			url = url.trim();
		}
		
		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		SnippetUtils.createSnippetDirectory(key);
		SnippetUtils.writeContentToSnippetFile(url, key, `${Config.SNIPPET_TEXT_FILE}.url`);

		const structure: SnippetStructure = {
			filename: `${Config.SNIPPET_TEXT_FILE}.url`,
			type: SnippetStructureItemType.File,
			loc: 1,
			children: null
		};

		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.URL,
			structure: structure
		});

		store.update();
		Logger.success("URL saved");
		return true;
	}

	static async editSnippetContent(key: string): Promise<boolean> {
		const store = new Store();

		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("snippet not found");
			return false;
		}

		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
			Logger.error("can only edit text/file/URLs");
			return false;
		}
		
		const filePath = SnippetUtils.getFileUnderSnippet(
			key,
			record.structure.filename!
		);

		const snippet = await FileUtils.readSnippetFromFile(filePath);

		if(!snippet) {
			Logger.error("error reading data");
			return false;
		}

		if(record.type == SnippetType.URL) {
			const rl = readline.createInterface({ input, output });
			console.log(`Current URL: ${snippet.trim()}`);
			const newURL = (await rl.question('Enter new URL (press Enter to abort): ')).trim();
			
			if(newURL.length == 0) {
				Logger.success("update aborted");
				return true;
			}

			if(!FileUtils.writeTextFile(filePath, newURL)) {
				Logger.error("error updating URL");
				return false;
			}

			Logger.success("URL updated");
			return true;
		}

		const fileType = MiscUtils.getFileType(filePath, true, "txt");
		const tempFilePath = MiscUtils.createRandomFileAndOpenInEditor(fileType, snippet);

		if(!tempFilePath) {
			Logger.error("error launching text editor");
			return false;
		}

		if(FileUtils.writeTextFile(filePath, FileUtils.readTextFile(tempFilePath)!)) {		
			store.update();
			return true;
		}

		Logger.error("failed to read/write files");
		return false;
	}

	static async saveDirectory(): Promise<boolean> {
		// TODO: add code
		return false;
	}

	static async saveMultipleFiles(): Promise<boolean> {
		// TODO: add code
		return false;
	}
}