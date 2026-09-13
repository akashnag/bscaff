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

import { ClipboardManager } from "../core/clipboard.js";
import { Store } from "../core/store.js";
import { SnippetType } from "../types/types.js";
import { Config } from "../utils/config.js";
import { FileUtils } from "../utils/file-utils.js";
import { Logger } from "../utils/logger.js";
import { MiscUtils } from "../utils/misc.js";
import { SnippetUtils } from "../utils/snippet.js";
import path from 'path';

export class RecallSnippet {
	static async copySnippetToMemory(key: string): Promise<boolean> {
		const cm = new ClipboardManager();

		try {
			const store = new Store();
			if(!store.doesSnippetKeyExist(key)) {
				Logger.error("key not found");
				return false;
			}
			
			const record = store.fetchSnippetRecord(key);
			if(!record) {
				Logger.error("can't fetch record");
				return false;
			}

			if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
				Logger.error("can only use snippets of type text/file/URL");
				return false;
			}

			const snippet = await FileUtils.readSnippetFromFile(
				SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
			);

			if(!snippet) {
				Logger.error("error reading snippet");
				return false;
			}
	
			cm.copy(snippet);
			Logger.success("snippet copied to clipboard");
			return true;
		} catch(error) {
			Logger.error("unknown error encountered in <copySnippetToMemory>");
			return false;
		}
	}

	static async openURLInBrowser(key: string): Promise<boolean> {
		const store = new Store();
		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type != SnippetType.URL) {
			Logger.error("can only launch URLs");
			return false;
		}

		const url = await FileUtils.readSnippetFromFile(
			SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
		);

		if(!url) {
			Logger.error("error reading URL");
			return false;
		}

		const retVal = await MiscUtils.executeCommand(`google-chrome ${url}`);
		if(retVal) {
			Logger.success(`URL launched: ${url}`);
		}

		return retVal;
	}

	static async appendOrPrependToFile(key: string, mode: 'append' | 'prepend', paths: string[]): Promise<boolean> {
		const store = new Store();
		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
			Logger.error("can only use snippets of type text/file/URL");
			return false;
		}

		const snippet = await FileUtils.readSnippetFromFile(
			SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
		);

		if(!snippet) {
			Logger.error("error reading snippet");
			return false;
		}

		const cwd = process.cwd();
		let c: number = 0;
		for(let i: number = 0; i < paths.length; ++i) {
			const filePath = path.resolve(cwd, paths[i]);
			if(!FileUtils.doesFileExist(filePath)) {
				Logger.error(`file not found, skipping: ${paths[i]}`);
			} else {
				let retVal = false;
				if(mode == 'append')
					retVal = FileUtils.appendToTextFile(filePath, snippet);
				else
					retVal = FileUtils.prependToTextFile(filePath, snippet);

				if(!retVal) {
					Logger.error(`error writing to file: ${paths[i]}`);
				} else {
					++c;
				}
			}
		}

		Logger.success(`${c} files updated`);
		return true;
	}

	static async displaySnippet(key: string): Promise<boolean> {
		const store = new Store();
		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
			Logger.error("can only use snippets of type text/file/URL");
			return false;
		}

		const snippet = await FileUtils.readSnippetFromFile(
			SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
		);

		if(!snippet) {
			Logger.error("error reading snippet");
			return false;
		}

		console.log(snippet);
		return true;
	}
}