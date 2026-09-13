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
import { exec, spawnSync } from 'child_process';
import { execSync } from 'child_process';
import { Config } from "./config.js";

export class MiscUtils {
	static getPlatform(): string {
		return process.platform.toString();
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

	static getFileType(filePath: string, includeDot: boolean = true, defaultExtension: string = "txt"): string {
		const pos = filePath.lastIndexOf(".");
		if(pos < 0) {
			return (includeDot ? "." : "") + defaultExtension;
		} else {
			return filePath.substring(pos);
		}
	}

	static createRandomFileAndOpenInEditor(fileType: string = "txt", content: string | null = null): string | null {
		const fileName = (+new Date()).toString() + "_" + MiscUtils.getRandomInt(1000, 9999).toString() + (fileType.startsWith(".") ? "" : ".") + fileType;
		const path = Config.getStoragePath([ fileName ]);
		if(content) {
			if(!FileUtils.writeTextFile(path, content)) return null;
		}
		if(!MiscUtils.openFileInEditor(path)) return null;
		return path;
	}

	static getRandomInt(min: number, max: number): number {
		// Ensure inputs are integers
		const minCeil = Math.ceil(min);
		const maxFloor = Math.floor(max);
		
		// The maximum is inclusive and the minimum is inclusive
		return Math.floor(Math.random() * (maxFloor - minCeil + 1)) + minCeil;
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
	
	/**
	 * Checks if a command binary is available in the system PATH
	 */
	private static isCommandAvailable(command: string): boolean {
		const checkCmd = (MiscUtils.getPlatform() === 'win32') ? `where ${command}` : `which ${command}`;
		try {
			execSync(checkCmd, { stdio: 'ignore' });
			return true;
		} catch {
			return false;
		}
	}

	/**
     * Opens a file in a terminal editor, falling back to a GUI editor if unavailable.
     * Blocks execution until the editor is closed.
     * 
     * @returns true if opened and closed successfully, false on failure.
     */
    private static openFileInEditor(filePath: string, preferredTerminalEditor: string = 'nano'): boolean {
        const isTerminalAvailable = MiscUtils.isCommandAvailable(preferredTerminalEditor);

        if (isTerminalAvailable) {
            try {
                // stdio: 'inherit' attaches TTY so interactive terminal editors (nano/vim) work
                const result = spawnSync(preferredTerminalEditor, [filePath], { stdio: 'inherit' });
                return result.status === 0 && result.error === undefined;
            } catch (err) {
                console.error(`Failed to launch ${preferredTerminalEditor}:`, err);
                return false;
            }
        } else {
            console.warn(`'${preferredTerminalEditor}' not found. Falling back to GUI editor...`);
            return MiscUtils.openFileInGUIEditor(filePath);
        }
    }

    /**
     * Platform-independent GUI file launcher (blocking mode).
     * 
     * @returns true if opened and closed successfully, false on failure.
     */
    private static openFileInGUIEditor(filePath: string): boolean {
        let command: string;
        let args: string[];

        switch (process.platform) {
            case 'darwin': // macOS (-W waits for the opened application to exit)
                command = 'open';
                args = ['-W', '-t', filePath];
                break;
            
            case 'win32': // Windows (/WAIT blocks until launched application closes)
                command = 'cmd';
                args = ['/c', 'start', '/wait', '', filePath];
                break;
            
            default: // Linux / BSD
                command = MiscUtils.isCommandAvailable('gedit') ? 'gedit' : 'xdg-open';
                args = [filePath];
                break;
        }

        try {
            const result = spawnSync(command, args, { stdio: 'ignore' });
            return result.status === 0 && result.error === undefined;
        } catch (err) {
            console.error(`Failed to open GUI editor on ${process.platform}:`, err);
            return false;
        }
    }
}
