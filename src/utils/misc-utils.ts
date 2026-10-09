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

import * as process from "node:process";
import { exec, execSync, spawn, spawnSync } from "child_process";
import { promisify } from "util";
import { Config } from "../core/config.js";
import { Settings } from "../core/settings.js";
import { prompt } from "../io/io.js";
import * as FileUtils from "./file-utils.js";

const execPromisified = promisify(exec);

export function getPlatform(): string {
	return process.platform.toString();
}

export function getEnvironmentVariable(name: string): string | undefined {
	return process.env[name];
}

export function containsChar(text: string, charList: string[]): boolean {
	return charList.some((char) => text.includes(char));
}

export function countLines(str: string): number {
	if (!str) return 0;
	return str.split(/\r?\n/).length;
}

export function splitContentByLines(str: string): string[] {
	if (!str) return [];
	return str.split(/\r?\n/);
}

export function indentLines(str: string, n: number = 0): string {
	if (n <= 0) return str;

	const lines = str.split(/\r?\n/);
	for (let i = 0; i < lines.length; ++i) {
		lines[i] = " ".repeat(n) + lines[i];
	}

	return lines.join("\n");
}

export function createTempFile(
	fileType: string = "txt",
	content: string | null = null,
	openInEditor: boolean = true,
	detach: boolean = true,
): string | null {
	const fileName =
		(+new Date()).toString() +
		"_" +
		getRandomInt(1000, 9999).toString() +
		"." +
		fileType;
	const path = Config.getStoragePath([Config.TEMP_DIRECTORY, fileName]);
	if (content) {
		if (!FileUtils.writeTextFile(path, content)) return null;
	}

	if (openInEditor) {
		if (!openFileInEditor(path)) return null;
	}
	return path;
}

export function createTempDirectory(): string | null {
	const dir =
		"temp_" +
		(+new Date()).toString() +
		"_" +
		getRandomInt(1000, 9999).toString();

	const path = Config.getStoragePath([dir]);
	if (FileUtils.createDirectory(path)) {
		return path;
	}

	return null;
}

// Generates a random integer between min and max (both inclusive)
export function getRandomInt(min: number, max: number): number {
	// Ensure inputs are integers
	const minCeil = Math.ceil(min);
	const maxFloor = Math.floor(max);

	// The maximum is inclusive and the minimum is inclusive
	return Math.floor(Math.random() * (maxFloor - minCeil + 1)) + minCeil;
}

// Finds the name of the function which called the current function
export function getCallerName(): string | null {
	const stack = new Error().stack;
	if (!stack) return null;

	// Split stack trace into lines
	const lines = stack.split("\n");

	// Line 0: Error message
	// Line 1: getCallerName (this function)
	// Line 2: The current function
	// Line 3: The caller of the current function
	const callerLine = lines[3];
	if (!callerLine) return null;

	// Extract function name using regex
	const match = callerLine.match(/at\s+([^\s]+)/);
	return match ? match[1] : "anonymous / global";
}

export async function openURLInBrowser(url: string): Promise<boolean> {
	const browser = Settings.get("browser");
	return executeCommand(`${browser} ${url}`, true);
}

// Executes an OS-specific script file
export function executeScript(
	scriptPath: string,
	scriptWorkingDir: string,
	args: string = "",
): Promise<string> {
	return new Promise((resolve, reject) => {
		const formattedArgs = args.trim() ? ` ${args.trim()}` : "";

		const isWindows = getPlatform() === "win32";
		const command = isWindows
			? `"${scriptPath}" ${formattedArgs}`
			: `sh "${scriptPath}" ${formattedArgs}`;

		exec(command, { cwd: scriptWorkingDir }, (error, stdout, stderr) => {
			if (error) {
				reject(new Error(`Failed: ${error.message}\n${stderr}`));
				return;
			}
			resolve(stdout);
		});
	});
}

// opens file for editing in terminal-editor or if it fails then a gui-editor (unless in settings user has set preference to gui first)
export function openFileInEditor(
	filePath: string,
	detach: boolean = false,
): boolean {
	const textEditor = Settings.get("textEditor");
	const isAvailable = textEditor && isCommandAvailable(textEditor!);

	if (isAvailable) {
		try {
			// stdio: 'inherit' attaches TTY so interactive terminal editors (nano/vim) work
			let result;
			if (detach) {
				const child = spawn(textEditor!, [filePath], {
					detached: true,
					stdio: "ignore",
				});
				child.unref();
				return true;
			} else {
				result = spawnSync(textEditor!, [filePath], {
					stdio: "inherit",
				});
				return result.status === 0 && result.error === undefined;
			}
		} catch (err) {
			console.error(`Failed to launch ${textEditor}:`, err);
			return false;
		}
	} else {
		return false;
	}
}

export function getSizeOfTextContent(text: string): number {
	return new TextEncoder().encode(text).length;
}

export function formatFileSize(
	bytes: number | null,
	decimals: number = 2,
): string | null {
	if (bytes === null) return null;

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["B", "KB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	// Safeguard against extreme sizes matching beyond the array boundary
	const unitIndex = Math.min(i, sizes.length - 1);

	return `${parseFloat((bytes / Math.pow(k, unitIndex)).toFixed(dm))} ${sizes[unitIndex]}`;
}

export function deepClone<T>(obj: T): T {
	return structuredClone(obj);
}

export function openFileByOS(
	filePath: string,
	detach: boolean = true,
): boolean {
	let command: string | null;
	let args: string[];

	switch (process.platform) {
		case "darwin": // macOS (-W waits for the opened application to exit)
			command = "open";
			args = ["-W", "-t", filePath];
			break;

		case "win32": // Windows (/WAIT blocks until launched application closes)
			command = "cmd";
			args = ["/c", "start", "/wait", "", filePath];
			break;

		default: // Linux / BSD
			command = "xdg-open";
			args = [filePath];
			break;
	}

	if (!command) return false;

	try {
		let result;

		if (detach) {
			const child = spawn(command, args, { detached: true, stdio: "ignore" });
			child.unref();
			return true;
		} else {
			result = spawnSync(command, args, { stdio: "inherit" });
			return result.status === 0 && result.error === undefined;
		}
	} catch (err) {
		console.error(`Failed to open on ${process.platform}:`, err);
		return false;
	}
}

export function executeCommand(
	command: string,
	detach: boolean = true,
): boolean {
	if (!command) return false;

	try {
		let result;

		if (detach) {
			const child = spawn(command, [], { detached: true, stdio: "ignore" });
			child.unref();
			return true;
		} else {
			result = spawnSync(command, [], { stdio: "inherit" });
			return result.status === 0 && result.error === undefined;
		}
	} catch (err) {
		console.error(`Failed to execute on ${process.platform}:`, err);
		return false;
	}
}

export function asSingleLineString(data: any): string {
	return data
		.toString()
		.replaceAll("\t", " ")
		.replaceAll("\r\n", " ")
		.replaceAll("\n", " ");
}

// ------------------------- [private] -------------------------

function isCommandAvailable(command: string | null): boolean {
	if (!command) return false;
	const checkCmd =
		getPlatform() === "win32" ? `where ${command}` : `which ${command}`;
	try {
		execSync(checkCmd, { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
}
