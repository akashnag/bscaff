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

import * as fs from 'fs';
import { isBinaryFile } from 'isbinaryfile';
import * as tar from 'tar';
import * as path from 'path';
import { Logger } from './logger.js';
import { ClipboardManager } from '../core/clipboard.js';
import { MiscUtils } from './misc.js';

export class FileUtils {
	static doesFileExist(filePath: string): boolean {
		return fs.existsSync(filePath);
	}

	static getFileNameFromPath(filePath: string): string {
		const platform = MiscUtils.getPlatform();
		if(platform == 'win32')
			return path.win32.basename(filePath);
		else
			return path.posix.basename(filePath);
	}

	static copyFile(filePath: string, newFilePath: string): boolean {
		try {
			fs.copyFileSync(filePath, newFilePath);
			return true;
		} catch(error) {
			return false;
		}
	}

	static deleteFile(filePath: string): boolean {
		try {
			fs.unlinkSync(filePath);
			return true;
		} catch(error) {
			return false;
		}
	}

	static async isTextFile(filePath: string): Promise<boolean> {
		try {
			const isBinary = await isBinaryFile(filePath);
			return !isBinary;
		} catch(error) {
			return false;
		}
	}

	static readTextFile(filePath: string): string | null {
		try {
			return fs.readFileSync(filePath, 'utf-8');
		} catch(error) {
			return null;
		}
	}

	static writeTextFile(filePath: string, content: string): boolean {
        if(!content) return false;
		try {
            fs.writeFileSync(filePath, content, 'utf-8');
            return true;
        } catch(error) {
            return false;
        }
    }

	/**
     * Appends content to the end of a file.
     * Creates the file if it does not already exist.
     */
    static appendToTextFile(filePath: string, content: string): boolean {
        try {
            fs.appendFileSync(filePath, content, 'utf-8');
            return true;
        } catch(error) {
            return false;
        }
    }

    /**
     * Prepends content to the beginning of a file.
     * If the file doesn't exist, it creates a new file with the content.
     */
    static prependToTextFile(filePath: string, content: string): boolean {
        try {
            let existingContent = '';
            if (fs.existsSync(filePath)) {
                existingContent = fs.readFileSync(filePath, 'utf-8');
            }
            fs.writeFileSync(filePath, content + existingContent, 'utf-8');
            return true;
        } catch(error) {
            return false;
        }
    }

	static renameDirectory(oldPath: string, newPath: string): boolean {
		try {
			fs.renameSync(oldPath, newPath);
			return true;
		} catch(error) {
			return false;
		}
	}

	static createDirectory(path: string): boolean {
		try {
			fs.mkdirSync(path, { recursive: false });
			return true;
		} catch(error) {
			return false;
		}
	}

	static deleteDirectory(path: string): boolean {
		try {
		  	fs.rmSync(path, { recursive: true, force: true });
		  	return true;
		} catch (error) {
		  	return false;
		}
	}

	static async readSnippetFromFile(filePath: string): Promise<string | null> {
		if(!FileUtils.doesFileExist(filePath)) {
			Logger.error("file does not exist");
			return null;
		}

		if(!(await FileUtils.isTextFile(filePath))) {
			Logger.error("file is not a text file");
			return null;
		}

		const snippet = FileUtils.readTextFile(filePath);
		if(!snippet) {
			Logger.error("error reading from file");
			return null;
		}

		return snippet;
	}

	/**
	 * Archives and compresses multiple files into a single .tar.gz archive.
	 * 
	 * @param filePaths - Array of absolute or relative file paths to compress
	 * @param outputPath - Output destination path for the .tar.gz file
	 */
	async gzipFiles(filePaths: string[], outputPath: string): Promise<void> {
		// Extract shared base directories to avoid absolute paths inside the archive
		const cwd = path.dirname(filePaths[0] || '.');
		const relativeFiles = filePaths.map(filePath => path.relative(cwd, filePath));
	
		await tar.create(
			{
				gzip: true,
				file: outputPath,
				cwd: cwd
			},
			relativeFiles
		);
	}
	
	/**
	 * Archives and compresses an entire directory into a .tar.gz archive.
	 * 
	 * @param dirPath - Path to the directory to compress
	 * @param outputPath - Output destination path for the .tar.gz file
	 */
	async gzipDirectory(dirPath: string, outputPath: string): Promise<void> {
		const parentDir = path.dirname(dirPath);
		const folderName = path.basename(dirPath);
	
		await tar.create(
			{
				gzip: true,
				file: outputPath,
				cwd: parentDir 		// Sets context to parent folder so top-level folder remains intact
			},
			[folderName]
		);
	}

	/**
	 * Synchronously copies a directory and all of its contents (files and subdirectories).
	 * 
	 * @param src - Source folder path
	 * @param dest - Destination folder path
	 */
	static copyDirSync(src: string, dest: string): void {
		// 1. Ensure target directory exists
		if (!fs.existsSync(dest)) {
			fs.mkdirSync(dest, { recursive: true });
		}

		// 2. Read all items inside source directory
		const entries = fs.readdirSync(src, { withFileTypes: true });

		// 3. Process each file/folder recursively
		for (const entry of entries) {
			const srcPath = path.join(src, entry.name);
			const destPath = path.join(dest, entry.name);

			if (entry.isDirectory()) {
				// Recursively copy subfolder
				FileUtils.copyDirSync(srcPath, destPath);
			} else {
				// Copy file (preserves timestamps/mode flags when possible)
				fs.copyFileSync(srcPath, destPath);
			}
		}
	}

	static resolveFilePaths(paths: string[]): string[] {
		const cwd = process.cwd();
		const newPaths = [];

		for(let i = 0; i < paths.length; ++i) {
			newPaths.push(path.resolve(cwd, paths[i]));
		}

		return newPaths;
	}
}
