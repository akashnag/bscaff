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

import { FileUtils } from "./file-utils.js";
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';

export class MiscUtils {
	static getPlatform(): NodeJS.Platform {
		return process.platform;
	}

	static countLOC(codeString: string): number {
		const lines = codeString.split(/\r?\n/);
		
		// Filter out blank lines or lines that are just comments
		const codeLines = lines.filter(line => {
			const trimmed = line.trim();
			
			// Skip empty lines and single-line comments
			if (trimmed === '' || trimmed.startsWith('//')) {
				return false;
			}

			return true;
		});
	
		return codeLines.length;
	}

	static async countLOCFromFile(filePath: string): Promise<number | null> {
		if(! await FileUtils.isTextFile(filePath)) return null;

		const data = FileUtils.readTextFile(filePath);
		if(!data) return null;

		return MiscUtils.countLOC(data);
	}

	/**
	 * Executes an OS-specific script file
	 * @param scriptPath The full path to the location of the script file
	 * @param scriptWorkingDir The working directory that should be considered by the script
	 */
	static executeScript(scriptPath: string, scriptWorkingDir: string): Promise<string> {
		return new Promise((resolve, reject) => {
			const isWindows = (MiscUtils.getPlatform() === 'win32');
			const command = isWindows ? `"${scriptPath}"` : `sh "${scriptPath}"`;
			exec(command, { cwd: scriptWorkingDir }, (error, stdout, stderr) => {
				if (error) {
				  reject(new Error(`Failed: ${error.message}\n${stderr}`));
				  return;
				}
				resolve(stdout);
			});
		});
	}
}
