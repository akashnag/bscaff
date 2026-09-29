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
import { Config } from "../core/config.js";
import { Settings } from "../core/settings.js";
import { Store } from "../core/store.js";
import {
	CopySnapshotIO,
	ExtractSnapshotIO,
	OpenSnapshotIO,
} from "../io/extract-io.js";
import { SnapshotRecord, SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

// --------------------------------------------------------
// copy [path] [--as-tree]
// --------------------------------------------------------
export async function copyToClipboard(
	key: string | undefined,
	asTree: boolean | undefined,
	relPath: string | undefined,
): Promise<boolean> {
	const cm = new ClipboardManager();
	const io = new CopySnapshotIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();
	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const record = store.fetch(key);
	if (!record) {
		io.errorFetchingSnapshot(key);
		return false;
	}

	switch (record.type) {
		case SnapshotType.URL:
			await cm.copy(record.urlContent!);
			break;

		case SnapshotType.Snippet:
			const snippetFile = SnapshotUtils.getFileUnderSnapshot(
				key,
				record.fileName!,
			);
			const snippetContent = await FileUtils.readTextFile(snippetFile);

			if (!snippetContent) {
				io.errorFetchingSnapshot(key);
				return false;
			}

			await cm.copy(snippetContent);
			break;

		case SnapshotType.Template:
		case SnapshotType.Files:
		case SnapshotType.Tree:
			if (relPath) {
				if (asTree) {
					io.warnOptionIgnored("--as-tree");
				}

				const hasFile = await SnapshotUtils.doesSnapshotContainFile(
					record,
					relPath,
				);
				if (!hasFile) {
					io.errorInvalidFile(key, record, relPath);
					return false;
				}

				const file = SnapshotUtils.getFileUnderSnapshot(key, relPath);
				if (!FileUtils.doesFileExist(file)) {
					io.errorInvalidFile(key, record, relPath);
					return false;
				}

				const content = await FileUtils.readTextFile(file);
				if (!content) {
					io.errorReadingSnapshotFile(key, record.type, relPath);
					return false;
				}

				await cm.copy(content);
			} else {
				if (!asTree || record.type == SnapshotType.Files) {
					const fileList = TreeUtils.getFileListFromStructure(
						record.structure!,
					);
					await cm.copy(fileList);
					break;
				}

				const tree = TreeUtils.drawFileTree(record.structure!);
				await cm.copy(tree);
			}

			break;
	}

	io.successSnapshotCopied(key, record.type);
	return true;
}
// --------------------------------------------------------

// --------------------------------------------------------
// open [path]
// --------------------------------------------------------
export async function openSnapshotReadOnly(
	key: string | undefined,
	relPath: string | undefined,
): Promise<boolean> {
	const io = new OpenSnapshotIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();
	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const record = store.fetch(key);
	if (!record) {
		io.errorFetchingSnapshot(key);
		return false;
	}

	switch (record.type) {
		case SnapshotType.URL:
			if (!(await MiscUtils.openURLInBrowser(record.urlContent!))) {
				io.errorOpeningURL(Settings.get("browser"), record.urlContent);
				return false;
			}
			break;

		case SnapshotType.Snippet:
			const snippetFile = SnapshotUtils.getFileUnderSnapshot(
				key,
				record.fileName!,
			);
			const snippetContent = await FileUtils.readTextFile(snippetFile);

			if (!snippetContent) {
				io.errorFetchingSnapshot(key);
				return false;
			}

			// open editor in detached mode
			MiscUtils.createRandomFileAndOpenInEditor(
				FileUtils.getFileType(snippetFile),
				snippetContent,
			);
			break;

		case SnapshotType.Template:
		case SnapshotType.Files:
		case SnapshotType.Tree:
			if (!relPath) {
				io.errorMissingParameter("rel-path");
				return false;
			}

			const hasFile = await SnapshotUtils.doesSnapshotContainFile(
				record,
				relPath,
			);
			if (!hasFile) {
				io.errorInvalidFile(key, record, relPath);
				return false;
			}

			const file = SnapshotUtils.getFileUnderSnapshot(key, relPath);
			if (!FileUtils.doesFileExist(file)) {
				io.errorInvalidFile(key, record, relPath);
				return false;
			}

			const content = await FileUtils.readTextFile(file);
			if (!content) {
				io.errorReadingSnapshotFile(key, record.type, relPath);
				return false;
			}

			MiscUtils.createRandomFileAndOpenInEditor(
				FileUtils.getFileType(file),
				content,
			);
			break;
	}

	return true;
}
// --------------------------------------------------------

// --------------------------------------------------------
// extract <to-path> [--dry-run] [--partial <rel-path>] [--if-exists <behaviour>]
// --------------------------------------------------------
export async function extract(
	key: string | undefined,
	dryRun: boolean | undefined,
	overwriteBehaviour: string | undefined,
	partialRelativePath: string | undefined,
	toPath: string,
): Promise<boolean> {
	const io = new ExtractSnapshotIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();
	if (!store.doesKeyExist(key)) {
		io.errorKeyNotFound(key);
		return false;
	}

	const record = store.fetch(key);
	if (!record) {
		io.errorFetchingSnapshot(key);
		return false;
	}

	toPath = FileUtils.resolvePath(toPath);
	if (partialRelativePath && !partialRelativePath.startsWith("/")) {
		partialRelativePath = "/" + partialRelativePath;
	}

	if (
		![SnapshotType.Files, SnapshotType.Template, SnapshotType.Tree].includes(
			record.type,
		)
	) {
		io.errorExtractionUnsupported(record.type);
		return false;
	}

	if (!record.structure && record.type !== SnapshotType.Template) {
		io.errorCorruptedData("structure");
		return false;
	}

	if (!record.parameters) {
		io.errorCorruptedData("parameters");
		return false;
	}

	if (!overwriteBehaviour) overwriteBehaviour = "prompt";
	if (!dryRun) dryRun = false;

	const parameterValues = io.promptForParameters(record.parameters);

	switch (record.type) {
		case SnapshotType.Files:
			return extractFiles(
				key,
				record,
				dryRun,
				overwriteBehaviour,
				partialRelativePath,
				toPath,
				parameterValues,
			);

		case SnapshotType.Tree:
			return extractTree(
				key,
				record,
				dryRun,
				overwriteBehaviour,
				partialRelativePath,
				toPath,
				parameterValues,
			);

		case SnapshotType.Template:
			return extractTemplate(
				key,
				record,
				dryRun,
				overwriteBehaviour,
				partialRelativePath,
				toPath,
				parameterValues,
			);

		default:
			io.errorExtractionUnsupported(record.type);
			return false;
	}
}

async function extractFiles(
	key: string,
	record: SnapshotRecord,
	dryRun: boolean,
	overwriteBehaviour: string,
	partialRelativePath: string | undefined,
	toPath: string,
	parameterValues: Record<string, string>,
): Promise<boolean> {
	if (!record.structure) return false;
	if (record.type !== SnapshotType.Files) return false;

	const io = new ExtractSnapshotIO();

	for (let i = 0; i < record.structure.length; ++i) {
		if (record.structure[i].type !== "file") continue;
		if (partialRelativePath && record.structure[i].path !== partialRelativePath)
			continue;

		const relPath = MiscUtils.replacePlaceholdersInText(
			record.structure[i].path,
			parameterValues,
		);
		const targetPath = FileUtils.formPath([toPath, relPath]);
		const sourcePath = SnapshotUtils.getFileUnderSnapshot(
			key,
			record.structure[i].path,
		);

		if (!extractFile(io, dryRun, overwriteBehaviour, sourcePath, targetPath))
			return false;
	}

	return true;
}

async function extractTree(
	key: string,
	record: SnapshotRecord,
	dryRun: boolean,
	overwriteBehaviour: string,
	partialRelativePath: string | undefined,
	toPath: string,
	parameterValues: Record<string, string>,
): Promise<boolean> {
	if (!record.structure) return false;
	if (record.type !== SnapshotType.Tree) return false;

	const io = new ExtractSnapshotIO();
	for (let i = 0; i < record.structure.length; ++i) {
		const node = record.structure[i];

		if (
			partialRelativePath &&
			!isPathChild(partialRelativePath, node.path, node.type)
		) {
			continue;
		}

		const relPath = MiscUtils.replacePlaceholdersInText(
			node.path,
			parameterValues,
		);
		const targetPath = FileUtils.formPath([toPath, relPath]);
		const sourcePath = SnapshotUtils.getFileUnderSnapshot(key, node.path);

		if (node.type === "dir") {
			if (!FileUtils.doesDirectoryExist(targetPath)) {
				io.infoDirectoryCreate(targetPath);
				if (!dryRun) FileUtils.createDirectory(targetPath);
			} else {
				io.infoDirectoryCreateSkip(targetPath);
			}
		} else {
			if (!extractFile(io, dryRun, overwriteBehaviour, sourcePath, targetPath))
				return false;
		}
	}

	return true;
}

async function extractTemplate(
	key: string,
	record: SnapshotRecord,
	dryRun: boolean,
	overwriteBehaviour: string,
	partialRelativePath: string | undefined,
	toPath: string,
	parameterValues: Record<string, string>,
): Promise<boolean> {
	if (record.type !== SnapshotType.Template) return false;

	// TODO: add code
}
// --------------------- [private] ----------------------

function isPathChild(
	partialPath: string,
	fullPath: string,
	pathType: "file" | "dir",
): boolean {
	if (!partialPath.endsWith("/")) partialPath += "/";
	if (pathType === "dir" && !fullPath.endsWith("/")) fullPath += "/";

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

function extractFile(
	io: ExtractSnapshotIO,
	dryRun: boolean,
	overwriteBehaviour: string,
	sourcePath: string,
	targetPath: string,
): boolean {
	const exists = FileUtils.doesFileExist(targetPath);

	let overwrite = false;

	if (!exists) {
		io.infoFileCreate(targetPath);
	} else {
		switch (overwriteBehaviour) {
			case "prompt":
				overwrite = io.promptForFileOverwrite(targetPath);
				if (overwrite) io.infoFileCreateSkipPostPrompt();
				else io.infoFileCreateOverwritePostPrompt();
				break;

			case "skip":
				io.infoFileCreateSkip(targetPath);
				return true;

			case "fail":
				io.infoFileCreateFail(targetPath);
				return false;

			case "overwrite":
				io.infoFileCreateOverwrite(targetPath);
				overwrite = true;
				break;
		}
	}

	if (!dryRun && (!exists || overwrite)) {
		if (exists) FileUtils.deleteFile(targetPath);
		FileUtils.copyFile(sourcePath, targetPath);
	}

	return true;
}

/*

export async function appendOrPrependToFile(
	key: string,
	mode: "append" | "prepend",
	paths: string[],
): Promise<boolean> {
	const store = await Store.create();
	const logger = new Logger();

	if (!store.doesKeyExist(key)) {
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
		SnapshotUtils.getFileUnderSnippet(key, record.structure.filename!),
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

	if (!store.doesKeyExist(key)) {
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
		const localFilePath: string = SnapshotUtils.getFileUnderSnippet(
			key,
			record.structure.filename!,
		);
		let shouldOverwrite: boolean = false;
		const fileExists: boolean = FileUtils.doesFileExist(path);

		if (fileExists && !overwrite) {
			shouldOverwrite =
				(await MiscUtils.getche(`Overwrite (Y/N)? `)).toLowerCase() == "y";
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
*/

// ---------------------- [private] --------------------------------

/*
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
			path: SnapshotUtils.getFileUnderSnippet(
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
					await MiscUtils.getche(
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
		SnapshotUtils.getSnapshotDirectory(key),
		rootDirName,
	]);
	const destRootDirPath: string = FileUtils.formPath([path, rootDirName]);

	if (FileUtils.doesDirectoryExist(destRootDirPath) && !overwrite) {
		const shouldOverwrite =
			(
				await MiscUtils.getche(
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

	const snippetDir = SnapshotUtils.getSnapshotDirectory(key);

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
*/
