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
import { FileTreeNode, Template } from "../types/types.js";
import * as FileUtils from "./file-utils.js";
import * as MiscUtils from "./misc-utils.js";
import {
	drawFileTree,
	extractStructureFromASCIITree,
	extractStructureFromDirectory,
} from "./tree-utils.js";

export async function readTemplateFile(
	filePath: string,
): Promise<Template | null> {
	return await readYamlFile<Template>(filePath);
}

export async function writeTemplateFile(
	filePath: string,
	templateData: Template,
): Promise<boolean> {
	return writeYamlFile<Template>(filePath, templateData);
}

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

async function readYamlFile<T>(pathToFile: string): Promise<T | null> {
	try {
		const fileContent = await FileUtils.readTextFile(pathToFile);
		if (!fileContent) return null;
		const doc = YAML.parse(fileContent);
		return doc as T;
	} catch {
		return null;
	}
}

async function writeYamlFile<T>(pathToFile: string, data: T): Promise<boolean> {
	try {
		const yamlString = YAML.stringify(data);
		return FileUtils.writeTextFile(pathToFile, yamlString);
	} catch {
		return false;
	}
}
