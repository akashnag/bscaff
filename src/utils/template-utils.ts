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

import AdmZip from "adm-zip";
import * as fs from "fs/promises";
import YAML from "yaml";
import { Config } from "../core/config.js";
import { TemplateParseError } from "../types/errors.js";
import { Template, TemplateQuestion } from "../types/template-types.js";
import { FileTreeNode } from "../types/types.js";
import * as FileUtils from "./file-utils.js";
import * as MiscUtils from "./misc-utils.js";
import {
	drawFileTree,
	extractStructureFromASCIITree,
	extractStructureFromDirectory,
} from "./tree-utils.js";

// ------------------- [Zip operations] ---------------------

export function extractZipFile(
	zipFilePath: string,
	targetPath: string,
): boolean {
	const zip = new AdmZip(zipFilePath);
	zip.extractAllTo(targetPath, true);
	return true;
}

export function getZipRootDirectory(zipFilePath: string): string | null {
	try {
		const zip = new AdmZip(zipFilePath);
		const zipEntries = zip.getEntries();

		if (zipEntries.length === 0) {
			return null; // Empty zip
		}

		// Get the top-level segment of the very first entry
		// Example: "folder/subfolder/file.txt" -> "folder/"
		const firstEntryName = zipEntries[0].entryName;
		const firstSlashIndex = firstEntryName.indexOf("/");

		if (firstSlashIndex === -1) {
			// The first entry is a file in the absolute root of the zip
			return null;
		}

		const suspectedRoot = firstEntryName.substring(0, firstSlashIndex + 1);

		// Verify that EVERY entry in the zip starts with this exact root prefix
		for (const entry of zipEntries) {
			if (!entry.entryName.startsWith(suspectedRoot)) {
				return null; // Found a file or folder outside the suspected root
			}
		}

		return suspectedRoot; // Returns something like "my-project-master/"
	} catch (error) {
		return null;
	}
}

export function doesZipHaveFileUnderRootDirectory(
	zipFilePath: string,
	fileName: string,
	zipRootDir: string | null = null,
): boolean {
	try {
		if (!zipRootDir) zipRootDir = getZipRootDirectory(zipFilePath);
		if (!zipRootDir) return false;

		const targetPath = `${zipRootDir}${fileName}`;

		const zip = new AdmZip(zipFilePath);
		const entry = zip.getEntry(targetPath);

		// Ensure it exists and is not a directory
		return entry !== null && !entry.isDirectory;
	} catch (error) {
		return false;
	}
}

// ------------------- [Template operations] ---------------------

export function writeTemplate(
	template: Template,
	filePath?: string,
): string | boolean {
	try {
		const content = YAML.stringify(template);
		if (filePath) {
			return FileUtils.writeTextFile(filePath, content);
		} else {
			return content;
		}
	} catch (err) {
		throw new TemplateParseError(
			`Failed to serialize template to YAML: ${(err as Error).message}`,
			err,
		);
	}
}

export async function readTemplateFile(
	filePath: string,
): Promise<Template | null> {
	const fileContent = await FileUtils.readTextFile(filePath);
	if (!fileContent) return null;

	let rawDoc: unknown;
	try {
		rawDoc = YAML.parse(fileContent);
	} catch (err) {
		throw new TemplateParseError(
			`Failed to parse YAML syntax in ${filePath}: ${(err as Error).message}`,
			err,
		);
	}

	if (typeof rawDoc !== "object" || rawDoc === null) {
		throw new TemplateParseError(
			`Invalid template file structure in ${filePath}. Root must be an object.`,
		);
	}

	return normalizeAndValidateTemplate(rawDoc as Record<string, unknown>);
}

function normalizeAndValidateTemplate(raw: Record<string, unknown>): Template {
	const template: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(raw)) {
		if (key.startsWith("_")) {
			(template as Record<string, unknown>)[key] = value;
		} else {
			// Normalize shorthand prompt definitions
			if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				template[key] = value as TemplateQuestion;
			} else {
				// Expand shorthand string/boolean/number defaults into Question objects
				template[key] = {
					default: value as TemplateQuestion["default"],
					type:
						typeof value === "number"
							? "int"
							: typeof value === "boolean"
								? "bool"
								: "str",
				};
			}
		}
	}

	return template as Template;
}
