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
import YAML from "yaml";
import { YAMLParseError } from "../types/errors.js";
import * as FileUtils from "./file-utils.js";

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

// ------------------- [YAML operations] ---------------------

/**
 * Serializes an object/value into a YAML string, throwing a YAMLParseError on failure.
 */
export function stringifyYaml(data: unknown): string {
	try {
		return YAML.stringify(data);
	} catch (err) {
		const error = err as Error;

		const lineNumber =
			(err as { line?: number; mark?: { line?: number } }).line ??
			(err as { mark?: { line?: number } }).mark?.line;

		throw new YAMLParseError(error.message, err, lineNumber);
	}
}

/**
 * Reads a text file and parses its contents as YAML, throwing a YAMLParseError on failure.
 * Returns null if the file content is empty or falsey.
 */
export async function readYamlFile<T = unknown>(
	filePath: string,
): Promise<T | null> {
	const fileContent = await FileUtils.readTextFile(filePath);
	if (!fileContent) return null;

	try {
		return YAML.parse(fileContent) as T;
	} catch (err) {
		const error = err as Error;

		const lineNumber =
			(err as { linePos?: { line?: number }[] }).linePos?.[0]?.line ??
			(err as { line?: number }).line ??
			(err as { mark?: { line?: number } }).mark?.line;

		throw new YAMLParseError(error.message, err, lineNumber);
	}
}
