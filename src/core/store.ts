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
import * as MiscUtils from "../utils/misc-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";
import { Config } from "./config.js";

export class Store {
	private list: SnapshotRecord[];
	private keyMap: Map<string, number>;

	private constructor(data: SnapshotRecord[] | null = null) {
		this.list = data || [];
		this.keyMap = new Map<string, number>();
		this.__rebuildKeyMap();
	}

	private __rebuildKeyMap(): void {
		this.keyMap.clear();
		for (let i = 0; i < this.list.length; ++i) {
			this.keyMap.set(this.list[i].key, i);
		}
	}

	// Static factory method handles the async logic
	static async create(): Promise<Store> {
		const data = await Store.__read();
		return new Store(data);
	}

	renameKey(oldKey: string, newKey: string): boolean {
		if (this.doesKeyExist(newKey)) return false;

		const index = this.fetchIndex(oldKey);
		if (index < 0) return false;

		const record = this.list[index];
		if (!record) return false;

		this.list[index].key = newKey;
		this.list[index].modifiedAt = new Date();

		this.keyMap.delete(oldKey);
		this.keyMap.set(newKey, index);

		if (record.type !== SnapshotType.URL) {
			return SnapshotUtils.renameSnapshotDirectory(oldKey, newKey);
		}

		return true;
	}

	updateDescription(key: string, desc: string): boolean {
		const index = this.fetchIndex(key);
		if (index < 0) return false;

		const record = this.list[index];
		if (!record) return false;

		this.list[index].description = desc;
		this.list[index].modifiedAt = new Date();
		return true;
	}

	updateTags(key: string, tags: string | string[]): boolean {
		const index = this.fetchIndex(key);
		if (index < 0) return false;

		const record = this.list[index];
		if (!record) return false;

		if (!Array.isArray(tags)) tags = tags.split(",");
		this.list[index].tags = tags;
		this.list[index].modifiedAt = new Date();
		return true;
	}

	updateURL(key: string, url: string): boolean {
		const index = this.fetchIndex(key);
		if (index < 0) return false;

		const record = this.list[index];
		if (!record) return false;
		if (record.type !== SnapshotType.URL) return false;

		this.list[index].urlContent = url;
		this.list[index].modifiedAt = new Date();
		return true;
	}

	updateStructure(key: string, newStructure: FileTreeNode[]): boolean {
		const index = this.fetchIndex(key);
		if (index < 0) return false;

		const record = this.list[index];
		if (!record) return false;

		this.list[index].structure = newStructure;
		this.list[index].modifiedAt = new Date();

		return true;
	}

	updateCreationTime(key: string, cTime: Date): boolean {
		const index = this.fetchIndex(key);
		if (index < 0) return false;

		const record = this.list[index];
		if (!record) return false;

		this.list[index].createdAt = cTime;
		return true;
	}

	doesKeyExist(key: string): boolean {
		return this.keyMap.has(key);
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
		this.keyMap.set(info.key, this.list.length - 1);
		return true;
	}

	// WARNING: returns a copy, not reference to original record
	fetch(key: string): SnapshotRecord | null {
		const index = this.keyMap.get(key);
		return index !== undefined ? MiscUtils.deepClone(this.list[index]) : null;
	}

	fetchIndex(key: string): number {
		return this.keyMap.get(key) ?? -1;
	}

	delete(key: string): boolean {
		if (this.doesKeyExist(key)) {
			const index = this.fetchIndex(key);
			if (index < 0) return false;

			let success = true;

			if (this.list[index].type !== SnapshotType.URL) {
				success = SnapshotUtils.deleteSnapshotDirectory(key);
			}

			if (success) {
				this.list.splice(index, 1);
			}

			this.__rebuildKeyMap();
			return success;
		}

		return false;
	}

	deletePartial(key: string, relPath: string): boolean {
		const record = this.fetch(key);
		if (!record) return false;
		if (!record.structure) return false;

		if (![SnapshotType.Files, SnapshotType.Tree].includes(record.type)) {
			return false;
		}

		const index =
			SnapshotUtils.getRecordStructureIndexOfFileOrDirectoryFromRelativePath(
				record,
				relPath,
			);
		if (index < 0) return false;

		const item = record.structure[index];

		const { structure, delFileCount, delDirCount } =
			SnapshotUtils.deleteFileOrDirectoryUnderSnapshot(
				key,
				relPath,
				item.type,
				record.structure,
			);

		if (delFileCount + delDirCount === 0) return false;

		return this.updateStructure(key, structure);
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
