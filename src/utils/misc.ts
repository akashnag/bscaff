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

import { stdin as input, stdout as output } from "node:process";
import * as readline from "node:readline/promises";
import { exec, execSync, spawnSync } from "child_process";
import { promisify } from "util";
import { Settings } from "../core/settings.js";
import { FileTreeNode } from "../types/types.js";
import { Config } from "./config.js";
import * as FileUtils from "./file-utils.js";

const execPromisified = promisify(exec);

export function getPlatform(): string {
	return process.platform.toString();
}

export function containsChar(text: string, charList: string[]): boolean {
	return charList.some((char) => text.includes(char));
}

export function countLOC(codeString: string): number {
	const lines = codeString.split(/\r?\n/);

	// Filter out blank lines or lines that are just comments
	const codeLines = lines.filter((line) => {
		const trimmed = line.trim();

		// Skip empty lines and single-line comments
		if (trimmed === "" || trimmed.startsWith("//")) {
			return false;
		}

		return true;
	});

	return codeLines.length;
}

export async function countLOCFromFile(
	filePath: string,
): Promise<number | null> {
	if (!(await FileUtils.isTextFile(filePath))) return null;

	const data = FileUtils.readTextFile(filePath);
	if (!data) return null;

	return countLOC(data);
}

// Given a path to a file, returns the extension of that file
export function getFileType(
	filePath: string,
	includeDot: boolean = true,
	defaultExtension: string = "txt",
): string {
	const pos = filePath.lastIndexOf(".");
	if (pos < 0) {
		return (
			(includeDot && defaultExtension.trim().length > 0 ? "." : "") +
			defaultExtension
		);
	} else {
		return filePath.substring(pos);
	}
}

export function createRandomFileAndOpenInEditor(
	fileType: string = "txt",
	content: string | null = null,
): string | null {
	const fileName =
		(+new Date()).toString() +
		"_" +
		getRandomInt(1000, 9999).toString() +
		(fileType.startsWith(".") ? "" : ".") +
		fileType;
	const path = Config.getStoragePath([fileName]);
	if (content) {
		if (!FileUtils.writeTextFile(path, content)) return null;
	}
	if (!openFileInEditor(path)) return null;
	return path;
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

// Executes an arbitrary system command
export async function executeCommand(command: string): Promise<boolean> {
	try {
		await execPromisified(command);
		return true;
	} catch {
		return false;
	}
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
	preferredTerminalEditor: string | null = null,
): boolean {
	if (!preferredTerminalEditor)
		preferredTerminalEditor = Settings.get("terminalEditor");
	const isTerminalAvailable =
		Settings.get("editorPreference") == "terminal"
			? isCommandAvailable(preferredTerminalEditor!)
			: false;

	if (isTerminalAvailable) {
		try {
			// stdio: 'inherit' attaches TTY so interactive terminal editors (nano/vim) work
			const result = spawnSync(preferredTerminalEditor!, [filePath], {
				stdio: "inherit",
			});
			return result.status === 0 && result.error === undefined;
		} catch (err) {
			console.error(`Failed to launch ${preferredTerminalEditor}:`, err);
			return false;
		}
	} else {
		console.warn(
			`'${preferredTerminalEditor}' not found. Falling back to GUI editor...`,
		);
		return openFileInGUIEditor(filePath);
	}
}

// Extracts all parameters enclosed within {{ and }} from a string
export function getParametersFromFilename(filename: string): string[] {
	// Regex matching {{ followed by non-}} characters, capturing the inner content
	const regex = /\{\{([^}]+)\}\}/g;
	const matches: string[] = [];

	let match: RegExpExecArray | null;
	while ((match = regex.exec(filename)) !== null) {
		// match[1] refers to the first capture group (inside {{ }})
		matches.push(match[1].trim());
	}

	return matches;
}

export function replacePlaceholdersInText(
	template: string,
	params: Record<string, string>,
): string {
	return template.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, key) => {
		return key in params ? params[key] : match;
	});
}

export async function prompt(question: string): Promise<string> {
	const rl = readline.createInterface({ input, output });
	return (await rl.question(question)).trim();
}

export function replacePlaceholdersInFile(
	pathType: "directory" | "file",
	filePath: string,
	params: Record<string, string>,
): string {
	const exclusions = Settings.get("excludeFromContentModification")!.split(";");

	// rename file
	const parts = FileUtils.getPathAndFileName(filePath);
	parts.filename = replacePlaceholdersInText(parts.filename, params);
	const newFilePath = Config.formPath([parts.path, parts.filename]);
	if (filePath != newFilePath) {
		if (pathType == "file") FileUtils.renameFile(filePath, newFilePath);
		else FileUtils.renameDirectory(filePath, newFilePath);
	}

	if (pathType == "directory") return newFilePath;

	// check if content-modification is allowed
	for (let i = 0; i < exclusions.length; ++i) {
		if (!exclusions[i].startsWith("*.")) continue;
		if (
			filePath.toLowerCase().endsWith(exclusions[i].substring(1).toLowerCase())
		)
			return newFilePath;
	}

	// perform content modification
	let text: string | null = FileUtils.readTextFile(newFilePath);
	if (text) {
		text = replacePlaceholdersInText(text, params);
		FileUtils.writeTextFile(newFilePath, text);
	}

	return newFilePath;
}

export function extractStructureFromTree(tree: string): any | null {
	const chars = {
		branch: "├",
		node: "─",
		comment: "#",
		lastNode: "└",
		trunk: "│",
	};

	const illegalChars = [
		" ",
		"<",
		">",
		":",
		'"',
		"/",
		"\\",
		"|",
		"?",
		"*",
		"\0",
		// Includes ASCII control characters 0 to 31
		...Array.from({ length: 32 }, (_, i) => String.fromCharCode(i)),
	];

	const treeLines: string[] = tree.split("\n");
	const struct: FileTreeNode[] = [];
	const levelDirs: any = {};
	const parameters: Set<string> = new Set<string>();

	for (let i = 0; i < treeLines.length; ++i) {
		let s = treeLines[i];
		const p = s.indexOf(chars.comment);

		if (p >= 0) {
			s = s.substring(0, p);
		}

		const st = s.trim();

		if (st.length == 0 || st.endsWith(chars.trunk)) continue;

		let counter = 0;
		let level = 0;
		let name = "";

		if (
			st[0] != chars.branch &&
			st[0] != chars.node &&
			st[0] != chars.lastNode &&
			st[0] != chars.trunk
		) {
			name = st.substring(0, st.length - 1).trim();
			if (name.length == 0) continue;
			if (containsChar(name, illegalChars)) continue;
		} else {
			for (let j = 0; j < s.length; ++j) {
				if (
					s[j] == chars.branch ||
					s[j] == chars.lastNode ||
					s[j] == chars.trunk
				) {
					counter = 1;
				} else if (s[j] == " " || s[j] == chars.node) {
					++counter;
					if (counter == 3) {
						counter = 0;
						++level;
					}
				} else if (s[j] != chars.node) {
					name = s.substring(j).trim();
					break;
				}
			}

			name = st.endsWith("/") ? name.substring(0, name.length - 1) : name;
			if (name.length == 0) continue;
			if (containsChar(name, illegalChars)) continue;
		}

		let path = "";
		for (let j = 0; j < level; ++j) {
			path += "/" + levelDirs[j];
		}
		path += "/" + name;

		struct.push({
			type: st.endsWith("/") ? "dir" : "file",
			level: level,
			name: name,
			path: path,
		});

		const params = getParametersFromFilename(name);
		params.forEach((param: string) => {
			parameters.add(param);
		});

		if (st.endsWith("/")) levelDirs[level] = name;
	}

	if (struct.length <= 1) {
		return null;
	}

	return { structure: struct, parameters: parameters };
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

function openFileInGUIEditor(filePath: string): boolean {
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
			command = isCommandAvailable(Settings.get("guiEditor"))
				? Settings.get("guiEditor")
				: "xdg-open";
			args = [filePath];
			break;
	}

	if (!command) return false;

	try {
		const result = spawnSync(command, args, { stdio: "ignore" });
		return result.status === 0 && result.error === undefined;
	} catch (err) {
		console.error(`Failed to open GUI editor on ${process.platform}:`, err);
		return false;
	}
}
