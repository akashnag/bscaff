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

import { ClipboardManager } from "../core/clipboard.js";
import { Store } from "../core/store.js";
import { type SnippetRecord, SnippetType } from "../types/types.js";
import { Config } from "../utils/config.js";
import * as FileUtils from "../utils/files.js";
import { Logger } from "../utils/logger.js";
import * as MiscUtils from "../utils/misc.js";
import * as SnippetUtils from "../utils/snippet.js";
import * as TreeUtils from "../utils/tree.js";

export async function copySnippetToMemory(key: string): Promise<boolean> {
	const cm = new ClipboardManager();
	const logger = new Logger();

	try {
		const store = await Store.create();
		if (!store.doesSnippetKeyExist(key)) {
			logger.error("key not found");
			return false;
		}

		const record = store.fetchSnippetRecord(key);
		if (!record) {
			logger.error("can't fetch record");
			return false;
		}

		if (
			record.type != SnippetType.Text &&
			record.type != SnippetType.File &&
			record.type != SnippetType.URL
		) {
			logger.error("can only use snippets of type text/file/URL");
			return false;
		}

		if (!("filename" in record.structure)) return false;

		const snippet = await FileUtils.readTextFile(
			SnippetUtils.getFileUnderSnippet(key, record.structure.filename!),
		);

		if (!snippet) {
			logger.error("error reading snippet");
			return false;
		}

		cm.copy(snippet);
		logger.success("snippet copied to clipboard");
		return true;
	} catch {
		logger.error("unknown error encountered in <copySnippetToMemory>");
		return false;
	}
}

export async function openSnippet(key: string): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	const record = store.fetchSnippetRecord(key);
	if (!record) {
		logger.error("can't fetch record");
		return false;
	}

	let retVal = false;
	if (record.type == SnippetType.URL) {
		if (!("filename" in record.structure)) return false;

		// if URL then open URL via web browser
		const url = await FileUtils.readTextFile(
			SnippetUtils.getFileUnderSnippet(key, record.structure.filename!),
		);

		if (!url) {
			logger.error("error reading URL");
			return false;
		}

		retVal = await MiscUtils.executeCommand(`google-chrome ${url}`);
		if (retVal) {
			logger.success(`URL launched: ${url}`);
			retVal = true;
		}
	} else if (
		record.type == SnippetType.File ||
		record.type == SnippetType.Text
	) {
		if (!("filename" in record.structure)) return false;

		// if text/file, open it in a text editor
		const filePath = SnippetUtils.getFileUnderSnippet(
			key,
			record.structure.filename!,
		);
		const snippet = await FileUtils.readTextFile(filePath);

		if (!snippet) {
			logger.error("error reading snippet");
			return false;
		}

		const fileType = MiscUtils.getFileType(filePath);
		const tempFile = MiscUtils.createRandomFileAndOpenInEditor(
			fileType,
			snippet,
		);
		if (!tempFile) {
			logger.error("error launching text editor");
		} else {
			retVal = true;
		}
	} else {
		logger.error("can only open snippets of type text/file/url");
	}

	return retVal;
}

export async function appendOrPrependToFile(
	key: string,
	mode: "append" | "prepend",
	paths: string[],
): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	const record = store.fetchSnippetRecord(key);
	if (!record) {
		logger.error("can't fetch record");
		return false;
	}

	if (
		record.type != SnippetType.Text &&
		record.type != SnippetType.File &&
		record.type != SnippetType.URL
	) {
		logger.error("can only use snippets of type text/file/URL");
		return false;
	}

	if (!("filename" in record.structure)) return false;

	const snippet = await FileUtils.readTextFile(
		SnippetUtils.getFileUnderSnippet(key, record.structure.filename!),
	);

	if (!snippet) {
		logger.error("error reading snippet");
		return false;
	}

	// paths contains possibly relative filenames, filePaths contain absolute filenames
	const filePaths = FileUtils.resolvePaths(paths);

	let c: number = 0;
	for (let i: number = 0; i < paths.length; ++i) {
		const filePath = filePaths[i];
		if (!FileUtils.doesFileExist(filePath)) {
			logger.error(`file not found, skipping: ${paths[i]}`);
		} else {
			let retVal = false;
			if (mode == "append")
				retVal = FileUtils.appendToTextFile(filePath, snippet);
			else retVal = FileUtils.prependToTextFile(filePath, snippet);

			if (!retVal) {
				logger.error(`error writing to file: ${paths[i]}`);
			} else {
				++c;
			}
		}
	}

	logger.success(`${c} files updated`);
	return true;
}

export async function displaySnippet(key: string): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	const record = store.fetchSnippetRecord(key);
	if (!record) {
		logger.error("can't fetch record");
		return false;
	}

	if (
		record.type != SnippetType.Text &&
		record.type != SnippetType.File &&
		record.type != SnippetType.URL
	) {
		logger.error("can only use snippets of type text/file/URL");
		return false;
	}

	if (!("filename" in record.structure)) return false;

	const snippet = await FileUtils.readTextFile(
		SnippetUtils.getFileUnderSnippet(key, record.structure.filename!),
	);

	if (!snippet) {
		logger.error("error reading snippet");
		return false;
	}

	console.log(snippet);
	return true;
}

export async function extractSnippet(
	key: string,
	path: string | null = null,
	overwrite: boolean = false,
): Promise<boolean> {
	const logger = new Logger();

	if (!path) {
		logger.error("missing path");
		return false;
	}

	path = FileUtils.resolvePath(path);

	const store = await Store.create();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("key not found");
		return false;
	}

	const record = store.fetchSnippetRecord(key);
	if (!record) {
		logger.error("can't fetch record");
		return false;
	}

	let paramValues: Record<string, string> = {};
	if (record.parameters) {
		paramValues = await MiscUtils.getParameterValuesFromUser(record.parameters);
	}

	// resolve paths
	path = FileUtils.resolvePath(path);

	if (record.type == SnippetType.File) {
		if (!("filename" in record.structure)) return false;
		const localFilePath: string = SnippetUtils.getFileUnderSnippet(
			key,
			record.structure.filename!,
		);
		let shouldOverwrite: boolean = false;
		const fileExists: boolean = FileUtils.doesFileExist(path);

		if (fileExists && !overwrite) {
			shouldOverwrite =
				(await MiscUtils.prompt(`Overwrite (Y/N)? `)).toLowerCase() == "y";
		}

		if (!fileExists || overwrite || shouldOverwrite) {
			if (
				(!fileExists || FileUtils.deleteFile(path)) &&
				FileUtils.copyFile(localFilePath, path)
			) {
				logger.success(`file extracted to: ${path}`);
				return true;
			} else {
				logger.error("could not extract file to destination");
				return false;
			}
		} else {
			logger.info("skipping");
		}

		return true;
	} else if (record.type === SnippetType.MultiFile) {
		if (!("filename" in record.structure)) return false;
		return await extractMultiFileTemplate(
			key,
			record,
			path,
			overwrite,
			paramValues,
		);
	} else if (record.type === SnippetType.Directory) {
		if (!("filename" in record.structure)) return false;
		return await extractDirectoryTemplate(
			key,
			record,
			path,
			overwrite,
			paramValues,
		);
	} else if (record.type == SnippetType.Tree) {
		if (!Array.isArray(record.structure)) return false;
		return await TreeUtils.createTree(
			path,
			record.structure,
			paramValues,
			overwrite,
		);
	} else {
		logger.error(
			"can only use snippets of type file/multi-file/directory/github-template",
		);
		return false;
	}
}

// ---------------------- [private] --------------------------------

async function extractMultiFileTemplate(
	key: string,
	record: SnippetRecord,
	path: string,
	overwrite: boolean,
	paramValues: Record<string, string>,
): Promise<boolean> {
	const logger = new Logger();
	if (!("children" in record.structure)) return false;

	const filesToExtract: { filename: string; path: string }[] = [];
	for (let i = 0; i < record.structure.children!.length; ++i) {
		filesToExtract.push({
			filename: record.structure.children![i].filename!,
			path: SnippetUtils.getFileUnderSnippet(
				key,
				record.structure.children![i].filename!,
			),
		});
	}

	for (let i = 0; i < filesToExtract.length; ++i) {
		const destPath: string = FileUtils.formPath([
			path,
			filesToExtract[i].filename,
		]);
		const fileExists: boolean = FileUtils.doesFileExist(destPath);
		let shouldOverwrite: boolean = false;

		if (fileExists && !overwrite) {
			shouldOverwrite =
				(
					await MiscUtils.prompt(
						`Overwrite '${filesToExtract[i].filename}' (Y/N)? `,
					)
				).toLowerCase() == "y";
		}

		if (!fileExists || overwrite || shouldOverwrite) {
			if (
				(!fileExists || FileUtils.deleteFile(destPath)) &&
				FileUtils.copyFile(filesToExtract[i].path, destPath)
			) {
				await MiscUtils.replacePlaceholdersInFile(
					"file",
					destPath,
					paramValues,
				);
				logger.success(`file extracted to: ${path}`);
				return true;
			} else {
				logger.error("could not extract file to destination");
				return false;
			}
		} else {
			logger.info("skipping");
		}
	}

	return true;
}

async function extractDirectoryTemplate(
	key: string,
	record: SnippetRecord,
	path: string,
	overwrite: boolean,
	paramValues: Record<string, string>,
): Promise<boolean> {
	if (!("filename" in record.structure)) return false;
	const logger = new Logger();

	// get root directory
	const rootDirName: string = record.structure.filename!;
	const concretizedRootDirName = MiscUtils.replacePlaceholdersInText(
		rootDirName,
		paramValues,
	);
	const sourceRootDirPath: string = FileUtils.formPath([
		SnippetUtils.getSnippetDirectory(key),
		rootDirName,
	]);
	const destRootDirPath: string = FileUtils.formPath([path, rootDirName]);

	if (FileUtils.doesDirectoryExist(destRootDirPath) && !overwrite) {
		const shouldOverwrite =
			(
				await MiscUtils.prompt(
					`Overwrite '${concretizedRootDirName}' and any of its contents (Y/N)? `,
				)
			).toLowerCase() == "y";
		if (!shouldOverwrite) return true;
	} else {
		// create directory parent
		FileUtils.createDirectory(path);
	}

	// execute pre-extraction hooks
	executeTriggers(
		"pre",
		key,
		path,
		record.triggers,
		MiscUtils.replacePlaceholdersInText(destRootDirPath, paramValues), // the would-be final directory (after replacing params)
	);

	// copy the directory as-is (without replacing params)
	FileUtils.copyDirectory(sourceRootDirPath, destRootDirPath);

	// Recursively process files and folders to replace placeholders
	async function processPath(currentPath: string): Promise<void> {
		// Read entries before processing
		const entries = FileUtils.readDirectoryContents(currentPath);

		for (const entry of entries) {
			const entryPath = FileUtils.formPath([currentPath, entry]);

			if (FileUtils.doesDirectoryExist(entry)) {
				// Recurse into subdirectories first (bottom-up traversal)
				processPath(entryPath);
				// Rename the directory using your library function
				await MiscUtils.replacePlaceholdersInFile(
					"directory",
					entryPath,
					paramValues,
				);
			} else if (FileUtils.doesFileExist(entry)) {
				// Rename file AND replace contents
				await MiscUtils.replacePlaceholdersInFile(
					"file",
					entryPath,
					paramValues,
				);
			}
		}
	}

	// Process all nested items inside the target root directory
	await processPath(destRootDirPath);

	// Finally, rename the root directory itself if needed
	const renamedDestDir = await MiscUtils.replacePlaceholdersInFile(
		"directory",
		destRootDirPath,
		paramValues,
	);

	// execute post-extraction hooks
	executeTriggers("post", key, renamedDestDir, record.triggers);

	logger.success("directory extracted");
	return true;
}

function executeTriggers(
	mode: "pre" | "post",
	key: string,
	workingDir: string,
	triggers: { preScript: string | null; postScript: string | null } | undefined,
	destDir: string | undefined = undefined,
) {
	if (!triggers) return;

	const snippetDir = SnippetUtils.getSnippetDirectory(key);

	if (mode == "pre" && triggers.preScript) {
		const preScriptPath = FileUtils.formPath([snippetDir, triggers.preScript]);
		MiscUtils.executeScript(preScriptPath, workingDir, destDir);
	}

	if (mode == "post" && triggers.postScript) {
		const postScriptPath = FileUtils.formPath([
			snippetDir,
			triggers.postScript,
		]);
		MiscUtils.executeScript(postScriptPath, workingDir);
	}
}
