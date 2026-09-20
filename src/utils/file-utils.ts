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

import * as fs from "fs";
import { isBinaryFile } from "isbinaryfile";
import * as path from "path";
import * as MiscUtils from "./misc.js";

export function doesFileExist(filePath: string): boolean {
	try {
		return fs.statSync(filePath).isFile();
	} catch {
		return false;
	}
}

export function doesDirectoryExist(dirPath: string): boolean {
	try {
		return fs.statSync(dirPath).isDirectory();
	} catch {
		return false;
	}
}

export function readDirectoryContents(dirPath: string): string[] {
	try {
		return fs.readdirSync(dirPath);
	} catch {
		return [];
	}
}

export function getFileNameFromPath(filePath: string): string {
	const platform = MiscUtils.getPlatform();
	if (platform == "win32") return path.win32.basename(filePath);
	else return path.posix.basename(filePath);
}

export function getPathAndFileName(filePath: string): {
	path: string;
	filename: string;
} {
	const platform = MiscUtils.getPlatform();
	const p = platform === "win32" ? path.win32 : path.posix;

	return {
		path: p.dirname(filePath),
		filename: p.basename(filePath),
	};
}

export function renameFile(oldPath: string, newPath: string): boolean {
	try {
		fs.renameSync(oldPath, newPath);
		return true;
	} catch {
		return false;
	}
}

export function copyFile(filePath: string, newFilePath: string): boolean {
	try {
		fs.copyFileSync(filePath, newFilePath);
		return true;
	} catch {
		return false;
	}
}

export function deleteFile(filePath: string): boolean {
	try {
		fs.unlinkSync(filePath);
		return true;
	} catch {
		return false;
	}
}

export async function isTextFile(filePath: string): Promise<boolean> {
	try {
		const isBinary = await isBinaryFile(filePath);
		return !isBinary;
	} catch {
		return false;
	}
}

export function readTextFile(filePath: string): string | null {
	try {
		return fs.readFileSync(filePath, "utf-8");
	} catch {
		return null;
	}
}

export function writeTextFile(filePath: string, content: string): boolean {
	if (!content) return false;
	try {
		fs.writeFileSync(filePath, content, "utf-8");
		return true;
	} catch {
		return false;
	}
}

export function appendToTextFile(filePath: string, content: string): boolean {
	try {
		fs.appendFileSync(filePath, content, "utf-8");
		return true;
	} catch {
		return false;
	}
}

export function prependToTextFile(filePath: string, content: string): boolean {
	try {
		let existingContent = "";
		if (fs.existsSync(filePath)) {
			existingContent = fs.readFileSync(filePath, "utf-8");
		}
		fs.writeFileSync(filePath, content + existingContent, "utf-8");
		return true;
	} catch {
		return false;
	}
}

export function renameDirectory(oldPath: string, newPath: string): boolean {
	try {
		fs.renameSync(oldPath, newPath);
		return true;
	} catch {
		return false;
	}
}

export function createDirectory(path: string): boolean {
	try {
		fs.mkdirSync(path, { recursive: false });
		return true;
	} catch {
		return false;
	}
}

export function deleteDirectory(path: string): boolean {
	try {
		fs.rmSync(path, { recursive: true, force: true });
		return true;
	} catch {
		return false;
	}
}

export async function readSnippetFromFile(
	filePath: string,
): Promise<string | null> {
	if (!doesFileExist(filePath)) {
		// file does not exist
		return null;
	}

	if (!(await isTextFile(filePath))) {
		// file is not a text file
		return null;
	}

	const snippet = readTextFile(filePath);
	if (!snippet) {
		// error reading from file
		return null;
	}

	return snippet;
}

export function copyDirectory(src: string, dest: string): void {
	// Ensure target directory exists
	if (!fs.existsSync(dest)) {
		fs.mkdirSync(dest, { recursive: true });
	}

	// Read all items inside source directory
	const entries = fs.readdirSync(src, { withFileTypes: true });

	// Process each file/folder recursively
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			// Recursively copy subfolder
			copyDirectory(srcPath, destPath);
		} else {
			// Copy file (preserves timestamps/mode flags when possible)
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

export function resolveFilePaths(paths: string[]): string[] {
	const cwd = process.cwd();
	const newPaths = [];

	for (let i = 0; i < paths.length; ++i) {
		newPaths.push(path.resolve(cwd, paths[i]));
	}

	return newPaths;
}
