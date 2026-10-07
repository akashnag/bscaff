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

import { TemplateSourceType } from "./template-types.js";

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

	// valid only for URL snapshot types
	urlContent?: string;

	/* fileName is valid for Snippet|Template
	   for Snippet: stores the snippet filename
	   for Template: stores the relative path (relative to the snapshot directory) to the template-config-file
	*/
	fileName?: string;

	createdAt?: Date;
	modifiedAt?: Date;

	// valid only for Template (and only for those with source=git)
	templateSource?: {
		sourceType: TemplateSourceType;
		url?: string;
		version?: string;
	};

	/* structure is valid only Tree|Template|Files
	   for Template: structure is the structure of the template._subdirectory folder (if specified) otherwise it is the structure of the snapshot directory
	   				 in both cases: the folder itself is not included in the entries
					 for parsing templates during extraction, check fileName to read the template, and then use template._subdirectory (if exists, or else the path of the config fileName) as the primary point to analyze structure
	*/
	structure?: FileTreeNode[];

	// parameters is valid only Tree|Template|Files
	parameters?: string[];
}

export interface BScaffSettings {
	textEditor: string;
	browser: string;
	templatesSuffix: string;
	include: string[];
	exclude: string[];
}
