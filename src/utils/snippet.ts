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

import { SnippetStructure, SnippetStructureItemType } from "../types/types.js";
import { Config } from "./config.js";
import { FileUtils } from "./file-utils.js";
import { MiscUtils } from "./misc.js";

export class SnippetUtils {
	static getSnippetsListDBPath(): string {
		return Config.getStoragePath([ Config.SNIPPET_DB_FILE ]);
	}

	static getSnippetDirectory(key: string): string {
		return Config.getStoragePath([ key ]);
	}

	static getFileUnderSnippet(key: string, filePath: string): string {
		const platform = MiscUtils.getPlatform();
		const delim = (platform == 'win32') ? '\\' : '/';
		const parts = filePath.split(delim);
		return Config.getStoragePath([ key, ...parts ]);
	}

	static createSnippetDirectory(key: string): boolean {
		FileUtils.createDirectory(SnippetUtils.getSnippetDirectory(key));
		return true;
	}

	static deleteSnippetDirectory(key: string): boolean {
		FileUtils.deleteDirectory(SnippetUtils.getSnippetDirectory(key));
		return true;
	}

	static renameSnippetDirectory(oldKey: string, newKey: string): boolean {
		const oldPath = SnippetUtils.getSnippetDirectory(oldKey);
		const newPath = SnippetUtils.getSnippetDirectory(newKey);
		FileUtils.renameDirectory(oldPath, newPath);
		return true;
	}

	static writeContentToSnippetFile(content: string, key: string, filePath: string): boolean {
		FileUtils.writeTextFile(SnippetUtils.getFileUnderSnippet(key, filePath), content);
		return true;
	}

	static async readContentFromSnippetFile(key: string, filePath: string): Promise<string | null> {
		return await FileUtils.readSnippetFromFile(SnippetUtils.getFileUnderSnippet(key, filePath));
	}

	static listSnippetFiles(struct: SnippetStructure, path: string = '', data: object[] = []): object[] {
		if(struct.type != SnippetStructureItemType.DummyNode) {
			data.push({
				type: struct.type.toString(),
				name: `${path}/${struct.filename}`,
				loc: (struct.type == SnippetStructureItemType.File) ? struct.loc?.toString() : '-'
			});
		}

		if(struct.type !== SnippetStructureItemType.File) {
			for(let i = 0; i < struct.children!.length; ++i) {
				const newPath = (struct.type == SnippetStructureItemType.Directory) ? `${path}/${struct.filename}` : path;
				this.listSnippetFiles(struct.children![i], newPath, data);
			}
		}

		return data;
	}

	static drawSnippetFileTree(struct: SnippetStructure, prefix: string = '', isLast: boolean = true, lines: string[] = []): string {
		// Format and add the current node (skip the root DummyNode)
		if (struct.type !== SnippetStructureItemType.DummyNode) {
			const connector = isLast ? '└── ' : '├── ';
			const isDir = struct.type === SnippetStructureItemType.Directory;
			const displayName = isDir ? `${struct.filename}/` : struct.filename;
	
			lines.push(`${prefix}${connector}${displayName}`);
		}
	
		// Recursively process children
		if (struct.type !== SnippetStructureItemType.File && struct.children) {
			let childPrefix = prefix;
			if (struct.type !== SnippetStructureItemType.DummyNode) {
				childPrefix += isLast ? '    ' : '│   ';
			}
	
			const count = struct.children.length;
			for (let i = 0; i < count; ++i) {
				const childIsLast = (i === count - 1);
				this.drawSnippetFileTree(struct.children[i], childPrefix, childIsLast, lines);
			}
		}
	
		// Return the complete string separated by newlines
		return lines.join('\n');
	}
}
