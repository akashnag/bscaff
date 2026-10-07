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

import simpleGit, { type SimpleGit } from "simple-git";
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
import { ScriptMissingError } from "../types/errors.js";
import { FileTreeNode, SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TemplateUtils from "../utils/template-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

// --------------------------------------------------------
// save tree [path] [--git]
// --------------------------------------------------------
export async function saveGitRepo(
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

	const git: SimpleGit = simpleGit.simpleGit();

	try {
		io.cloneStart(repoLocalDir);
		await git.clone(repoURL, repoLocalDir);
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
	const result = await TreeUtils.extractStructureFromDirectory(
		repoLocalDir,
		settingsOptions,
	);

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

export async function saveASCIITreeFromClipboard(
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
	({ structure, parameters, stats } =
		TreeUtils.extractStructureFromASCIITree(tree));

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

	await TreeUtils.createTree(
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

export async function saveDirectory(
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
	const result = await TreeUtils.extractStructureFromDirectory(
		dirPath,
		settingsOptions,
	);

	if (!result.structure || !result.parameters) {
		io.errorGeneric("saveDirectory::2");
		return false;
	}

	if (
		!(await TreeUtils.copyTree(
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
export async function saveSnippet(
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
		fileName: localFilePath,
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

// --------------------------------------------------------
// save snippet [--type file-type]
// --------------------------------------------------------
export async function saveSnippetFromLiveInput(
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
export async function saveURL(
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
export async function saveFiles(
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

	const { structure, parameters, stats } =
		await SnapshotUtils.copyFilesToSnapshotDirectory(key, files);

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
