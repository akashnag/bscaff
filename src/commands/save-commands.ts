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

import { SimpleGit, simpleGit } from "simple-git";
import { ClipboardManager } from "../core/clipboard.js";
import { Config } from "../core/config.js";
import { Settings } from "../core/settings.js";
import { Store } from "../core/store.js";
import { ConsoleIO } from "../io/io.js";
import {
	SaveASCIITreeIO,
	SaveDirectoryIO,
	SaveFilesIO,
	SaveGitRepoIO,
	SaveSnippetIO,
	SaveURLIO,
} from "../io/save-io.js";
import { ExtractTemplateIO } from "../io/template-io.js";
import { ScriptMissingError } from "../types/errors.js";
import { FileTreeNode, SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TemplateUtils from "../utils/template-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";
import * as CreateCommands from "./create-commands.js";

// --------------------------------------------------------
// save tree [path] [--git]
// --------------------------------------------------------
export async function handleSaveGitRepoCommand(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	repoURL: string | undefined,
): Promise<boolean> {
	const io = new SaveGitRepoIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!repoURL) {
		io.errorMissingParameter("repo-url");
		return false;
	}

	const store = await Store.create();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	SnapshotUtils.createSnapshotDirectory(key);

	let repoName = repoURL.substring(1 + repoURL.lastIndexOf("/"));
	if (repoName.endsWith(".git")) {
		repoName = repoName.substring(repoName.length - 4);
	}

	const snapshotDir = SnapshotUtils.getSnapshotDirectory(key);
	const repoLocalDir = FileUtils.formPath([snapshotDir, repoName]);
	FileUtils.createDirectory(repoLocalDir);

	const git: SimpleGit = simpleGit();

	try {
		io.cloneStart(repoLocalDir);
		await git.clone(repoURL, repoLocalDir);
		FileUtils.deleteDirectory(FileUtils.formPath([repoLocalDir, ".git"]));
		io.cloneComplete();
	} catch {
		io.cloneFailed();
		FileUtils.deleteDirectory(snapshotDir);
		return false;
	}

	const settingsOptions = {
		exclude: Settings.get("exclude") ?? undefined,
		include: Settings.get("include") ?? undefined,
	};
	const tagList = tags ? tags.split(",") : undefined;

	let result;
	try {
		result = await TreeUtils.extractStructureFromDirectory(
			repoLocalDir,
			settingsOptions,
		);
	} catch (err: any) {
		io.errorGeneric(
			"saveGitRepo: error extracting structure ==> " + err.toString(),
		);
		return false;
	}

	if (!result.structure || !result.parameters) {
		io.errorGeneric("saveGitRepo::1");
		return false;
	}

	store.save({
		key: key,
		description: description,
		type: SnapshotType.Tree,
		structure: result.structure!,
		parameters: result.parameters!,
		tags: tagList,
	});

	store.update();
	io.successSnapshotTaken(
		key,
		MiscUtils.formatFileSize(result.stats.sizeInBytes!),
		result.stats.fileCount!,
		result.stats.dirCount!,
		description,
		tagList,
	);

	return true;
}

export async function handleSaveASCIITreeFromClipboardCommand(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	promptForContent: boolean | undefined,
): Promise<boolean> {
	const io = new SaveASCIITreeIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();
	const cm = new ClipboardManager();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	const tagList = tags ? tags.split(",") : undefined;
	SnapshotUtils.createSnapshotDirectory(key);

	let structure = null;
	let parameters = null;
	let stats = null;

	const tree = (await cm.paste()).trim();

	try {
		({ structure, parameters, stats } =
			TreeUtils.extractStructureFromASCIITree(tree));
	} catch (err: any) {
		io.errorGeneric(
			"saveASCIITreeFromClipboard: error extracting structure ==> " +
				err.toString(),
		);
		return false;
	}

	if (!structure || !stats) {
		io.errorInvalidTree();
		return false;
	}

	let sizeInBytes = 0;
	let fileContents = null;

	if (promptForContent) {
		({ sizeInBytes, fileContents } = await io.promptForFileContents(
			cm,
			structure,
			true,
		));
	}

	await CreateCommands.createTree(
		SnapshotUtils.getSnapshotDirectory(key),
		structure,
	);

	store.save(
		{
			key: key,
			description: description,
			tags: tagList,
			type: SnapshotType.Tree,
			structure: structure,
			parameters: parameters!,
		},
		true,
	); // true = remove content from structure to not pollute database

	store.update();
	io.successSnapshotTaken(
		key,
		promptForContent ? MiscUtils.formatFileSize(sizeInBytes) : `0 B`,
		stats.fileCount,
		stats.dirCount,
		description,
		tagList,
		"Tree [memory]",
		structure,
	);

	return true;
}

export async function handleSaveDirectoryCommand(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	dirPath: string | undefined,
): Promise<boolean> {
	const io = new SaveDirectoryIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!dirPath) {
		io.errorMissingParameter("path");
		return false;
	}

	const store = await Store.create();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	const tagList = tags ? tags.split(",") : undefined;

	// files contains possibly relative filenames, filePaths contain absolute filenames
	dirPath = FileUtils.resolvePath(dirPath);

	// ensure the source directory before proceeding
	if (!FileUtils.doesDirectoryExist(dirPath)) {
		io.errorSourceDirectoryMissing(dirPath);
		return false;
	}

	// create snapshot directory
	if (!SnapshotUtils.createSnapshotDirectory(key)) {
		io.errorGeneric("saveDirectory::1");
		return false;
	}

	const settingsOptions = {
		exclude: Settings.get("exclude") ?? undefined,
		include: Settings.get("include") ?? undefined,
	};
	const destPath = SnapshotUtils.getSnapshotDirectory(key);

	let result;
	try {
		result = await TreeUtils.extractStructureFromDirectory(
			dirPath,
			settingsOptions,
		);
	} catch (err: any) {
		io.errorGeneric(
			"saveDirectory: error extracting structure ==> " + err.toString(),
		);
		return false;
	}

	if (!result.structure || !result.parameters) {
		io.errorGeneric("saveDirectory::2");
		return false;
	}

	if (
		!(await copyTree(
			dirPath,
			destPath,
			result.structure,
			"overwrite",
			undefined,
			false,
		))
	) {
		io.errorCopyingDirectoryTree(dirPath, destPath);
		return false;
	}

	store.save({
		key: key,
		description: description,
		type: SnapshotType.Tree,
		structure: result.structure!,
		parameters: result.parameters!,
		tags: tagList,
	});

	store.update();
	io.successSnapshotTaken(
		key,
		MiscUtils.formatFileSize(result.stats.sizeInBytes!),
		result.stats.fileCount!,
		result.stats.dirCount!,
		description,
		tagList,
	);

	return true;
}
// --------------------------------------------------------

// --------------------------------------------------------
// save snippet [path] [--type file-type [--memory]]
// --------------------------------------------------------
export async function handleSaveSnippetCommand(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	fType: string | undefined,
	fromMemory: boolean | undefined,
	filePath: string | undefined,
): Promise<boolean> {
	return await saveSnippet(key, description, tags, fType, fromMemory, filePath);
}

// --------------------------------------------------------
// save snippet [--type file-type]
// --------------------------------------------------------
export async function handleSaveSnippetFromLiveInputCommand(
	key: string | undefined,
	description?: string,
	tags?: string,
	fType?: string,
): Promise<boolean> {
	const io = new SaveSnippetIO();
	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	if (!fType) fType = "txt";

	const filePath = MiscUtils.createTempFile(fType, null, true);
	if (!filePath) {
		io.errorLaunchingTextEditor();
		return false;
	}

	const success = await saveSnippet(
		key,
		description,
		tags,
		undefined,
		false,
		filePath,
	);

	if (success) return FileUtils.deleteFile(filePath);

	return false;
}
// --------------------------------------------------------

// --------------------------------------------------------
// save url [url]
// --------------------------------------------------------
export async function handleSaveURLCommand(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	url: string | undefined,
): Promise<boolean> {
	const io = new SaveURLIO();
	const cm = new ClipboardManager();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	const tagList = tags ? tags.split(",") : undefined;
	let fromMemory = false;

	// files contains possibly relative filenames, filePaths contain absolute filenames
	if (!url) {
		url = await cm.paste();
		fromMemory = true;
	}

	if (!url || url.trim().length == 0) {
		io.errorNoURLFound(fromMemory);
		return false;
	}

	store.save({
		key: key,
		description: description,
		type: SnapshotType.URL,
		tags: tagList,
		urlContent: url,
	});

	store.update();
	io.successSnapshotTaken(key, null, 0, 0, description, tagList, url);

	return true;
}
// --------------------------------------------------------

// --------------------------------------------------------
// save files <...files>
// --------------------------------------------------------
export async function handleSaveFilesCommand(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	files: string[] | undefined,
): Promise<boolean> {
	const io = new SaveFilesIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!files) {
		io.errorMissingParameter("...files");
		return false;
	}

	files = FileUtils.resolvePaths(files);

	const store = await Store.create();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	const tagList = tags ? tags.split(",") : undefined;

	for (let i = 0; i < files.length; ++i) {
		if (!FileUtils.doesFileExist(files[i])) {
			io.errorSourceFileMissing(files[i]);
			return false;
		}
	}

	SnapshotUtils.createSnapshotDirectory(key);

	let structure, parameters, stats;
	try {
		({ structure, parameters, stats } =
			await SnapshotUtils.copyFilesToSnapshotDirectory(key, files));
	} catch (err: any) {
		io.errorGeneric(
			"saveFiles: error copying files to local cache ==> " + err.toString(),
		);
		return false;
	}

	store.save({
		key: key,
		description: description,
		type: SnapshotType.Template,
		tags: tagList,
		structure: structure,
		parameters: parameters,
	});

	store.update();
	io.successSnapshotTaken(
		key,
		MiscUtils.formatFileSize(stats.sizeInBytes),
		stats.fileCount,
		stats.dirCount,
		description,
		tagList,
		"Files",
	);

	return true;
}
// --------------------------------------------------------

// -------------------- [helpers] -------------------------

// WARNING: use this function only for saving snapshots, never for extracting them
export async function copyTree(
	sourceDir: string,
	destPath: string,
	nodes: FileTreeNode[],
	overwriteBehaviour: "fail" | "prompt" | "skip" | "overwrite" = "prompt",
	io?: ExtractTemplateIO,
	nestSourceDir: boolean = true,
): Promise<boolean> {
	try {
		// Resolve source path
		const absSourceDir = FileUtils.resolvePath(sourceDir);

		// Target base directory depends on nestSourceDir flag
		let targetBaseDir: string;

		if (nestSourceDir) {
			const sourceDirName =
				absSourceDir.split(/[/\\]/).filter(Boolean).pop() || "";
			targetBaseDir = FileUtils.resolvePath(`${destPath}/${sourceDirName}`);
		} else {
			targetBaseDir = FileUtils.resolvePath(destPath);
		}

		// Create the target directory
		FileUtils.createDirectory(targetBaseDir);

		// Sort nodes by level/path depth to ensure parent directories are created before files
		const sortedNodes = [...nodes].sort((a, b) => a.level - b.level);

		for (const node of sortedNodes) {
			// Build absolute source and destination paths
			const srcNodePath = FileUtils.formPath([absSourceDir, node.path]);
			const destNodePath = FileUtils.formPath([targetBaseDir, node.path]);

			if (node.type === "dir") {
				io?.infoCreateDirectory(destNodePath);
				FileUtils.createDirectory(destNodePath);
				continue;
			}

			// Check if file already exists at destination
			let destExists = false;
			try {
				destExists = FileUtils.doesFileExist(destNodePath);
			} catch {
				destExists = false;
			}

			if (destExists) {
				switch (overwriteBehaviour) {
					case "fail":
						return false;

					case "skip":
						continue;

					case "prompt": {
						const shouldOverwrite =
							await io?.promptForFileOverwrite(destNodePath);

						if (!shouldOverwrite) {
							continue; // Skip copying if user answers false
						}

						break;
					}

					case "overwrite":
						// Proceed to copy over existing file
						break;
				}
			}

			io?.infoCreateFile(destNodePath);
			FileUtils.copyFile(srcNodePath, destNodePath);
		}

		return true;
	} catch (error) {
		return false;
	}
}

async function saveSnippet(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	fType: string | undefined,
	fromMemory: boolean | undefined,
	filePath: string | undefined,
): Promise<boolean> {
	const io = new SaveSnippetIO();
	const cm = new ClipboardManager();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (fromMemory && filePath) {
		io.errorConflictingArgs("--memory", "file-path");
		return false;
	}

	const store = await Store.create();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	const tagList = tags ? tags.split(",") : undefined;
	let content: string | null = null;
	let fileType: string = "txt";
	let fromFile: boolean = false;

	if (filePath) {
		filePath = FileUtils.resolvePath(filePath);

		if (!FileUtils.doesFileExist(filePath)) {
			io.errorSourceFileMissing(filePath);
			return false;
		} else {
			if (fType) {
				io.errorConflictingArgs("path", "file-type");
				return false;
			}

			content = await FileUtils.readTextFile(filePath);
			fileType = FileUtils.getFileType(filePath);
			fromFile = true;
		}
	} else if (fromMemory) {
		content = await cm.paste();
		if (fType) fileType = fType;
	} else {
		io.errorGeneric("saveSnippet::1");
		return false;
	}

	if (!content || content.length == 0) {
		io.errorNoContentFound(fromFile);
		return false;
	}

	const localFilePath = `${Config.SINGLE_FILE_NAME}.${fileType}`;

	SnapshotUtils.createSnapshotDirectory(key);
	SnapshotUtils.writeContentToSnapshotFile(content, key, localFilePath);

	store.save({
		key: key,
		description: description,
		type: SnapshotType.Snippet,
		tags: tagList,
		snippetFileName: localFilePath,
	});

	store.update();
	io.successSnapshotTaken(
		key,
		`${MiscUtils.countLines(content)} lines`,
		0,
		0,
		description,
		tagList,
		content,
	);

	return true;
}
