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

import { FileTreeNode, SnapshotRecord, SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";
import { Config } from "./config.js";

export class Store {
	private list: SnapshotRecord[];

	private constructor(data: SnapshotRecord[] | null = null) {
		this.list = data || [];
	}

	// Static factory method handles the async logic
	static async create() {
		const data = await Store.__read();
		return new Store(data);
	}

	renameKey(oldKey: string, newKey: string): boolean {
		if (this.doesKeyExist(newKey)) return false;
		if (!this.doesKeyExist(oldKey)) return false;

		if (SnapshotUtils.renameSnapshotDirectory(oldKey, newKey)) {
			const record = this.fetch(oldKey);
			if (!record) return false;

			record.key = newKey;
			record.modifiedAt = new Date();
			return true;
		} else {
			return false;
		}
	}

	updateDescription(key: string, desc: string): boolean {
		if (this.doesKeyExist(key)) return false;
		const record = this.fetch(key);
		if (!record) return false;

		record.description = desc;
		record.modifiedAt = new Date();
		return true;
	}

	updateTags(key: string, tags: string | string[]): boolean {
		if (this.doesKeyExist(key)) return false;
		const record = this.fetch(key);
		if (!record) return false;

		if (!Array.isArray(tags)) tags = tags.split(",");
		record.tags = tags;
		record.modifiedAt = new Date();
		return true;
	}

	updateURL(key: string, url: string): boolean {
		if (this.doesKeyExist(key)) return false;
		const record = this.fetch(key);
		if (!record) return false;
		if (record.type != SnapshotType.URL) return false;

		record.urlContent = url;
		record.modifiedAt = new Date();
		return true;
	}

	updateStructure(key: string, newStructure: FileTreeNode[]): boolean {
		if (this.doesKeyExist(key)) return false;
		const record = this.fetch(key);
		if (!record) return false;

		record.structure = newStructure;
		record.modifiedAt = new Date();
		return true;
	}

	doesKeyExist(key: string): boolean {
		return this.list.some((record) => record.key === key);
	}

	save(info: SnapshotRecord, removeContent: boolean = false): boolean {
		if (this.doesKeyExist(info.key)) return false;

		info.createdAt = new Date();
		info.modifiedAt = new Date();

		if (removeContent && info.structure) {
			for (let i = 0; i < info.structure.length; ++i) {
				info.structure[i].content = undefined;
			}
		}

		if (info.structure) {
			info.structure = TreeUtils.sortTreeStructure(info.structure);
		}

		this.list.push(info);
		return true;
	}

	fetch(key: string): SnapshotRecord | null {
		const record = this.list.find((item) => item.key === key);
		return record ? record : null;
	}

	delete(key: string): boolean {
		if (this.doesKeyExist(key)) {
			const success = SnapshotUtils.deleteSnapshotDirectory(key);
			if (success) {
				this.list = this.list.filter((item) => item.key !== key);
			}
			return success;
		}

		return false;
	}

	update(): void {
		Store.__write(this.list);
	}

	getList(
		key: string | null = null,
	): { key: string; updated: Date; type: SnapshotType }[] {
		const data: { key: string; updated: Date; type: SnapshotType }[] = [];

		for (let i = 0; i < this.list.length; ++i) {
			const record = this.list[i];
			if (!key || record.key === key) {
				const outRec: { key: string; updated: Date; type: SnapshotType } = {
					key: record.key,
					updated: record.modifiedAt!,
					type: record.type,
				};

				data.push(outRec);
				if (key) break;
			}
		}

		return data;
	}

	getRawListFiltered(
		sTypes?: SnapshotType[],
		tags?: string[],
	): SnapshotRecord[] {
		let result = this.list;

		if (sTypes) {
			result = result.filter((item) => sTypes.indexOf(item.type) > -1);
		}

		if (tags) {
			result = result.filter((item) =>
				tags.every((element) => item.tags?.includes(element)),
			);
		}

		return result.sort((a, b) => a.key.localeCompare(b.key));
	}

	getRawList(key: string): SnapshotRecord {
		return this.list.find((item) => item.key === key)!;
	}

	// ---------------- I/O methods -------------------

	private static __write(snippets: SnapshotRecord[]): void {
		const filePath = SnapshotUtils.getSnapshotDB();
		const text = JSON.stringify(snippets, null, 2);
		FileUtils.writeTextFile(filePath, text);
	}

	private static async __read(): Promise<SnapshotRecord[] | null> {
		const filePath = SnapshotUtils.getSnapshotDB();
		const text = await FileUtils.readTextFile(filePath);
		if (text) {
			const data: SnapshotRecord[] = JSON.parse(text);
			return data;
		}
		return null;
	}
}
