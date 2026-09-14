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

import { SnippetRecord, SnippetInfo } from '../types/types.js';
import { Config } from '../utils/config.js';
import { FileUtils } from '../utils/file-utils.js';
import { SnippetUtils } from '../utils/snippet.js';

export class Store {
	private snippetsList: SnippetRecord[];

	constructor() {
		let data = Store.readSnippetsList();
		if(!data) data = [];
		this.snippetsList = data;
	}

	renameSnippetKey(oldKey: string, newKey: string): boolean {
		if(this.doesSnippetKeyExist(newKey)) return false;
		if(this.doesSnippetKeyExist(oldKey)) return false;

		const oldPath = Config.getStoragePath([ oldKey ]);
		const newPath = Config.getStoragePath([ newKey ]);

		if(FileUtils.renameDirectory(oldPath, newPath)) {
			const record = this.snippetsList.find(item => (item.key === oldKey));
			record!.key = newKey;
			record!.modifiedAt = new Date();		
			return true;
		} else {
			return false;
		}
	}

	doesSnippetKeyExist(key: string): boolean {
		return this.snippetsList.some(record => (record.key === key));
	}

	saveSnippet(info: SnippetInfo): boolean {
		const { key, type, structure, description } = info;
		if(this.doesSnippetKeyExist(key)) return false;

		const record: SnippetRecord = {
			key: key,
			description: description,
			type: type,
			createdAt: new Date(),
			modifiedAt: new Date(),
			structure: structure,
			parameters: info.parameters
		};

		if(info.triggers) {
			record.triggers = {
				preScript: info.triggers.preScript,
				postScript: info.triggers.postScript
			};
		}

		this.snippetsList.push(record);
		return true;
	}

	fetchSnippetRecord(key: string): SnippetRecord | null {
		const record = this.snippetsList.find(item => (item.key === key));
		return record ? record : null;
	}

	deleteSnippetRecord(key: string): boolean {
		this.snippetsList = this.snippetsList.filter(item => (item.key !== key));
		return true;
	}

	update(): void {
		Store.writeSnippetsList(this.snippetsList);
	}

	getList(key: string | null = null): object[] {
		const data = [];

		for(let i = 0; i < this.snippetsList.length; ++i) {
			const record = this.snippetsList[i];
			if(!key || record.key === key) {
				const outRec = {
					key: record.key,
					updated: record.modifiedAt,
					type: record.type.toString(),
					loc: record.structure.loc ? record.structure.loc.toString() : '-'		// TODO: change loc to content and show URLs (if type URL) else '-'
				};

				data.push(outRec);
				if(key) break;
			}
		}

		return data;
	}

	getRawList(key: string): SnippetRecord {
		return this.snippetsList.find(item => item.key === key)!;
	}

	// ---------------- I/O methods -------------------

	static writeSnippetsList(snippets: SnippetRecord[]): void {
        const filePath = SnippetUtils.getSnippetsListDBPath();
        const text = JSON.stringify(snippets, null, 2);
        FileUtils.writeTextFile(filePath, text);
    }

	static readSnippetsList(): SnippetRecord[] | null {
		const filePath = SnippetUtils.getSnippetsListDBPath();
		const text = FileUtils.readTextFile(filePath);
		if(text) {
			const data: SnippetRecord[] = JSON.parse(text);
			return data;
		}
		return null;
	}
}