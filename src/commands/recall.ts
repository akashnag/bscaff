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

			if(record.type != SnippetType.Text) {
				Logger.error("can only copy to memory snippets of type text");
				return false;
			}

			const snippet = await FileUtils.readSnippetFromFile(Config.getStoragePath([ key, "snippetText.snippet" ]));
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
}