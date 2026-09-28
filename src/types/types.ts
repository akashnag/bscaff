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

export type UUID = string & { readonly __brand: unique symbol };

export enum SnapshotType {
	Template = "Template", // file saved as <Config.SINGLE_FILE_NAME>.bs_template
	Snippet = "Snippet", // file saved as <Config.SINGLE_FILE_NAME>.<type|txt>
	Tree = "Tree",
	Files = "Files",
	URL = "URL", // file saved as <Config.SINGLE_FILE_NAME>.url
}

export interface FileTreeNode {
	type: "dir" | "file";
	level: number;
	name: string;
	path: string;
	content?: string | null;
	sizeInBytes?: number;
}

// actual format in which snapshot records are stored on database
export interface SnapshotRecord {
	key: string;
	description?: string;
	tags?: string[];

	type: SnapshotType;

	urlContent?: string; // only for URL types
	fileName?: string; // stores filename for Snippet, and config filename for Template

	createdAt?: Date;
	modifiedAt?: Date;

	structure?: FileTreeNode[]; // only for tree, template and files
	parameters?: string[];
}

export interface Template {
	// TODO: add code
}

export interface BScaffSettings {
	textEditor: string;
	browser: string;
	excludeFromContentModification: string;
	excludeFromContentInputPrompt: string;
	excludeDirectories: string[];
}
