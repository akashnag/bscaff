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

import { Store } from "../core/store.js";
import { Logger } from "../utils/logger.js";
import { SnippetUtils } from "../utils/snippet.js";

export class MiscSnippetManagement {
	static async deleteSnippet(key: string): Promise<boolean> {
		const store = new Store();

		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}

		if(SnippetUtils.deleteSnippetDirectory(key)) {
			store.deleteSnippetRecord(key);
		} else {
			return false;
		}

		store.update();
		Logger.success("Snippet deleted");
		return true;
	}

	static async renameSnippet(key: string, newKey: string): Promise<boolean> {
		const store = new Store();

		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}

		if(SnippetUtils.renameSnippetDirectory(key, newKey)) {
			store.renameSnippetKey(key, newKey);
		} else {
			return false;
		}

		store.update();
		Logger.success("Snippet renamed");
		return true;
	}
}
