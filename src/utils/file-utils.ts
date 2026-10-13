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
import process from "process";
import * as MiscUtils from "./misc-utils.js";

export function isPathChild(
	partialPath: string,
	fullPath: string,
	fullPathType: "file" | "dir",
): boolean {
	if (!partialPath.endsWith("/")) partialPath += "/";
	if (fullPathType === "dir" && !fullPath.endsWith("/")) fullPath += "/";

	if (!partialPath.startsWith("/")) partialPath = "/" + partialPath;
	if (!fullPath.startsWith("/")) fullPath = "/" + fullPath;

	/*
	Examples:
		partialPath = /dir1/dir2/
		fullPath:
					/dir1/dir2/dir3/file1.ext	--> TRUE
					/dir1/dir3/					--> FALSE
					/dir1/dir2/dir3/			--> TRUE
					/dir1/dir2/					--> TRUE
	*/
	return fullPath.startsWith(partialPath);
}

export function areRelativePathsSame(path1: string, path2: string) {
	if (!path1.startsWith("/")) path1 = "/" + path1;
	if (!path2.startsWith("/")) path2 = "/" + path2;
	return path1 === path2;
}

export function formPath(items: string[]): string {
	return path.join(...items);
}

export function formRelativePath(rootPath: string, fullPath: string) {
	return path.relative(rootPath, fullPath).replace(/\\/g, "/");
}

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

export function readDirectoryContentsWithTypes(dirPath: string): fs.Dirent[] {
	try {
		return fs.readdirSync(dirPath, { withFileTypes: true });
	} catch {
		return [];
	}
}

export function getFileNameFromPath(filePath: string): string {
	const platform = MiscUtils.getPlatform();
	if (platform == "win32") return path.win32.basename(filePath);
	else return path.posix.basename(filePath);
}

export function getContainingDirectoryOfFile(filePath: string): string {
	const platform = MiscUtils.getPlatform();
	if (platform === "win32") {
		return path.win32.basename(path.win32.dirname(filePath));
	} else {
		return path.posix.basename(path.posix.dirname(filePath));
	}
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

export function writeTextFile(filePath: string, content: string): boolean {
	if (content === null || content === undefined) return false;
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

export function createDirectory(
	path: string,
	recursive: boolean = false,
): boolean {
	try {
		fs.mkdirSync(path, { recursive: recursive });
		return true;
	} catch {
		return false;
	}
}

export function ensureDirectoryExists(dirPath: string) {
	if (!doesDirectoryExist(dirPath)) {
		createDirectory(dirPath);
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

export async function readTextFile(filePath: string): Promise<string | null> {
	if (!doesFileExist(filePath)) {
		// file does not exist
		return null;
	}

	if (!(await isTextFile(filePath))) {
		// file is not a text file
		return null;
	}

	try {
		const content = fs.readFileSync(filePath, "utf-8");
		return content;
	} catch {
		return null;
	}
}

/*
	Creates the directory at src inside dest.
	E.g. if src = /abc/def/xyz
	    and dest = /pqr/mno/
		Then: new tree will be rooted at: /pqr/mno/xyz
*/
export function copyDirectory(src: string, dest: string): string {
	const targetDir = path.join(dest, path.basename(src));
	copyDirectoryContents(src, targetDir);
	return targetDir;
}

function copyDirectoryContents(src: string, dest: string): string {
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
			copyDirectoryContents(srcPath, destPath);
		} else {
			// Copy file (preserves timestamps/mode flags when possible)
			fs.copyFileSync(srcPath, destPath);
		}
	}

	return path.join(dest, path.basename(src));
}

export function resolvePaths(paths: string[]): string[] {
	const cwd = process.cwd();
	const newPaths = [];

	for (let i = 0; i < paths.length; ++i) {
		newPaths.push(path.resolve(cwd, paths[i]));
	}

	return newPaths;
}

export function resolvePath(path: string): string {
	return resolvePaths([path])[0];
}

export function getFormattedFileSize(
	filePath: string,
	decimals: number = 2,
): string | null {
	return MiscUtils.formatFileSize(getFileSizeInBytes(filePath), decimals);
}

export function getFileSizeInBytes(filePath: string) {
	try {
		const stats = fs.statSync(filePath);
		if (!stats.isFile()) return null;

		const bytes = stats.size;
		return bytes;
	} catch {
		return null;
	}
}

export function getRelativePath(
	fullPath: string,
	basePath: string | null = null,
): string {
	if (!basePath) basePath = process.cwd();
	return path.relative(basePath, fullPath);
}

// Given a path to a file, returns the extension of that file
export function getFileType(
	filePath: string,
	includeDot: boolean = false,
	defaultExtension: string = "txt",
): string {
	const pos = filePath.lastIndexOf(".");
	if (defaultExtension.startsWith("."))
		defaultExtension = defaultExtension.substring(
			0,
			defaultExtension.length - 1,
		);

	if (pos < 0) {
		return (includeDot ? "." : "") + defaultExtension;
	} else {
		return filePath.substring(includeDot ? pos : pos + 1);
	}
}
