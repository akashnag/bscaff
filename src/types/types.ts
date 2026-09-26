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

export enum SnapshotType {
	Template = "TEMPLATE", // file saved as <Config.SINGLE_FILE_NAME>.bs_template
	Snippet = "SNIPPET", // file saved as <Config.SINGLE_FILE_NAME>.<type|txt>
	Tree = "TREE",
	Files = "FILES",
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
	fileName?: string; // only for snippet and template types

	createdAt?: Date;
	modifiedAt?: Date;

	structure?: FileTreeNode[];
	parameters?: string[];
}

export interface Template {
	structure: FileTreeNode[] | null;
	parameters: string[] | null;
	triggers: {
		preScript?: {
			fileType: string;
			content: string;
		};
		postScript?: {
			fileType: string;
			content: string;
		};
	};
}

export interface BScaffSettings {
	editorPreference: string;
	terminalEditor: string | null;
	guiEditor: string | null;
	browser: string | null;
	excludeFromContentModification: string;
}
