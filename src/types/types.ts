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

export enum SnippetType {
	Template = "TEMPLATE",
	Text = "TEXT",
	Directory = "DIRECTORY",
	Tree = "TREE", // tree copied from AI output
	File = "FILE",
	MultiFile = "MULTI_FILE",
	URL = "URL", // file saved as <Config.SNIPPET_TEXT_FILE>.url
}

export enum SnippetStructureItemType {
	File = "FILE", // used for SnippetType.Text and SnippetType.File
	Directory = "DIRECTORY", // used for SnippetType.DIRECTORY at the root level and also at sub-directory levels
	DummyNode = "DUMMY_NODE", // used for SnippetType.MultiFile at the root level
}

export interface FileTreeNode {
	type: "dir" | "file";
	level: number;
	name: string;
	path: string;
	content?: string | null;
	sizeInBytes?: number;
}

export interface SnippetStructure {
	filename: string | null;
	type: SnippetStructureItemType;
	children: SnippetStructure[] | null;
	sizeInBytes?: number | null;
}

// actual format in which snippet record is stored on database
export interface SnippetRecord {
	key: string;
	description: string | null;
	type: SnippetType;
	createdAt: Date;
	modifiedAt: Date;
	structure: SnippetStructure | FileTreeNode[];
	parameters: string[] | null;
	triggers?: {
		type: "path" | "content";
		preScript: string | null;
		postScript: string | null;
	};
}

export interface Template {
	structure: FileTreeNode[] | null;
	parameters: string[] | null;
	triggers?: {
		type: "path" | "content";
		preScript: string | null;
		postScript: string | null;
	};
}

// used to pass info to snippet utility functions
export interface SnippetInfo {
	key: string;
	description: string | null;
	type: SnippetType;
	structure: SnippetStructure | FileTreeNode[];
	parameters: string[] | null;
	triggers?: {
		type: "path" | "content";
		preScript: string | null;
		postScript: string | null;
	};
}

export interface BScaffSettings {
	editorPreference: string;
	terminalEditor: string | null;
	guiEditor: string | null;
	browser: string | null;
	excludeFromContentModification: string;
}

export interface DirectoryStructure {
	structure: SnippetStructure;
	parameters: Set<string>;
	fileCount?: number;
	dirCount?: number;
	sizeInBytes?: number;
}
