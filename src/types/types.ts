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
	Text = "TEXT",
	Directory = "DIRECTORY",
	File = "FILE",
	MultiFile = "MULTI_FILE",
	URL = "URL"							// file saved as <Config.SNIPPET_TEXT_FILE>.url
}

export enum SnippetStructureItemType {
	File = "FILE",						// used for SnippetType.Text and SnippetType.File
	Directory = "DIRECTORY",			// used for SnippetType.DIRECTORY at the root level and also at sub-directory levels
	DummyNode = "DUMMY_NODE"			// used for SnippetType.MultiFile at the root level
}

export interface SnippetStructure {
	filename: string | null;
	type: SnippetStructureItemType;
	loc: number | null;
	children: SnippetStructure[] | null;
}

export interface SnippetRecord {
	key: string;
	description: string | null;
	type: SnippetType;
	createdAt: Date;
	modifiedAt: Date;
	structure: SnippetStructure;
	parameters: string[] | null;
	triggers?: {
		preScript: string | null;
		postScript: string | null;
	}
}

export interface SnippetInfo {
	key: string;
	description: string | null;
	type: SnippetType;
	structure: SnippetStructure;
	parameters: string[] | null;
	triggers?: {
		preScript: string | null;
		postScript: string | null;
	}
}

export interface BScaffSettings {
	editorPreference: string;
	terminalEditor: string | null;
	guiEditor: string | null;
	browser: string | null;
	excludeFromContentModification: string;
}

export interface RecursionResult {
	structure: SnippetStructure;
	parameters: Set<string>;
}



/*
Contents of:  ~/.bscaff/

db.json
<folder1 named as key1 -- type text>
	snippetText.snippet
<folder2 named as key2 -- type file>
	<filename_with_extension>
<folder3 named as key3 -- type multi>
	<filename1_with_extension>
	<filename2_with_extension>
<folder4 named as key3 -- type multi>
...

*/