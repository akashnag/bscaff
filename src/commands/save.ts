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
import { Store } from "../core/store.js";
import {
	type DirectoryStructure,
	FileTreeNode,
	type SnippetStructure,
	SnippetStructureItemType,
	SnippetType,
} from "../types/types.js";
import { Config } from "../utils/config.js";
import * as FileUtils from "../utils/file-utils.js";
import { Logger } from "../utils/logger.js";
import * as MiscUtils from "../utils/misc.js";
import * as SnippetUtils from "../utils/snippet.js";

export async function saveTextFromFile(
	key: string,
	filePath: string | null = null,
	description: string | null = null,
): Promise<boolean> {
	/*
		(1) get the file type from filePath
		(2) create snippet directory and create a new file under it (with name = <Config.SNIPPET_TEXT_FILE>, and extension = filetype identified in step 1)
		(3) SnippetRecord.structure<SnippetStructure> = { filename: as in step-2, type: FILE, children: null }
	*/
	const logger = new Logger();

	if (!filePath) {
		logger.error("missing file path");
		return false;
	}

	filePath = FileUtils.resolveFilePaths([filePath])[0];

	const store = new Store();

	if (store.doesSnippetKeyExist(key)) {
		logger.error("key already exists");
		return false;
	}

	const snippet = await FileUtils.readSnippetFromFile(filePath);
	if (!snippet) {
		logger.error(
			"cannot read file: ensure it exists, is a text file and you have read permissions",
		);
		return false;
	}

	const fileType = MiscUtils.getFileType(filePath, true, "txt");

	SnippetUtils.createSnippetDirectory(key);
	SnippetUtils.writeContentToSnippetFile(
		snippet,
		key,
		`${Config.SNIPPET_TEXT_FILE}${fileType}`,
	);

	const structure: SnippetStructure = {
		filename: `${Config.SNIPPET_TEXT_FILE}${fileType}`,
		type: SnippetStructureItemType.File,
		children: null,
	};

	store.saveSnippet({
		key: key,
		description: description,
		type: SnippetType.Text,
		structure: structure,
		parameters: null,
	});

	store.update();
	logger.success("snippet saved");
	return true;
}

export async function saveFile(
	key: string,
	filePath: string | null = null,
	description: string | null = null,
): Promise<boolean> {
	/*
		(1) create snippet directory and create a new file under it (with name same as in filePath)
		(2) SnippetRecord.structure<SnippetStructure> = { filename: as in step-1, type: FILE, children: null }
	*/

	const logger = new Logger();

	if (!filePath) {
		logger.error("missing file path");
		return false;
	}

	filePath = FileUtils.resolveFilePaths([filePath])[0];

	const store = new Store();

	if (store.doesSnippetKeyExist(key)) {
		logger.error("key already exists");
		return false;
	}

	if (!FileUtils.doesFileExist(filePath)) {
		logger.error("file not found");
		return false;
	}

	const filename = FileUtils.getFileNameFromPath(filePath);

	SnippetUtils.createSnippetDirectory(key);
	FileUtils.copyFile(filePath, Config.getStoragePath([key, filename]));

	const structure: SnippetStructure = {
		filename: filename,
		type: SnippetStructureItemType.File,
		children: null,
	};

	store.saveSnippet({
		key: key,
		description: description,
		type: SnippetType.File,
		structure: structure,
		parameters: null,
	});

	store.update();
	logger.success("snippet saved");
	return true;
}

export async function saveLiveInput(
	key: string,
	fileType: string = "txt",
	description: string | null = null,
): Promise<boolean> {
	/*
		(1) get the file type from command-line args, or 'txt' if omitted by user
		(2) create snippet directory and create a new file under it (with name = <Config.SNIPPET_TEXT_FILE>, and extension = filetype identified in step 1)
		(3) SnippetRecord.structure<SnippetStructure> = { filename: as in step-2, type: FILE, children: null }
	*/

	const logger = new Logger();

	const path = MiscUtils.createRandomFileAndOpenInEditor(fileType);
	if (!path) {
		logger.error("could not launch text editor");
		return false;
	}
	const success = await saveTextFromFile(key, path, description);
	if (success) return FileUtils.deleteFile(path);
	return false;
}

export async function saveURL(
	key: string,
	url: string,
	description: string | null = null,
): Promise<boolean> {
	/*
		(1) create snippet directory and create a new file under it (with name = <Config.SNIPPET_TEXT_FILE>, and extension = '.url')
		(2) SnippetRecord.structure<SnippetStructure> = { filename: as in step-1, type: FILE, children: null }
	*/

	const logger = new Logger();

	if (!url) {
		logger.error("URL missing");
		return false;
	} else {
		url = url.trim();
	}

	const store = new Store();

	if (store.doesSnippetKeyExist(key)) {
		logger.error("key already exists");
		return false;
	}

	SnippetUtils.createSnippetDirectory(key);
	SnippetUtils.writeContentToSnippetFile(
		url,
		key,
		`${Config.SNIPPET_TEXT_FILE}.url`,
	);

	const structure: SnippetStructure = {
		filename: `${Config.SNIPPET_TEXT_FILE}.url`,
		type: SnippetStructureItemType.File,
		children: null,
	};

	store.saveSnippet({
		key: key,
		description: description,
		type: SnippetType.URL,
		structure: structure,
		parameters: null,
	});

	store.update();
	logger.success("URL saved");
	return true;
}

export async function editSnippetContent(key: string): Promise<boolean> {
	const store = new Store();
	const logger = new Logger();

	if (!store.doesSnippetKeyExist(key)) {
		logger.error("snippet not found");
		return false;
	}

	const record = store.fetchSnippetRecord(key);
	if (!record) {
		logger.error("can't fetch record");
		return false;
	}

	if (
		record.type !== SnippetType.Text &&
		record.type !== SnippetType.File &&
		record.type !== SnippetType.URL
	) {
		logger.error("can only edit text/file/URLs");
		return false;
	}

	if (!("filename" in record.structure)) {
		logger.error("can only edit text/file/URLs");
		return false;
	}

	const filePath = SnippetUtils.getFileUnderSnippet(
		key,
		record.structure.filename!,
	);

	const snippet = await FileUtils.readSnippetFromFile(filePath);

	if (!snippet) {
		logger.error("error reading data");
		return false;
	}

	if (record.type === SnippetType.URL) {
		console.log(`Current URL: ${snippet.trim()}`);

		const newURL = await MiscUtils.prompt(
			"Enter new URL (press Enter to abort): ",
		);

		if (newURL.length === 0) {
			logger.success("update aborted");
			return true;
		}

		if (!FileUtils.writeTextFile(filePath, newURL)) {
			logger.error("error updating URL");
			return false;
		}

		logger.success("URL updated");
		return true;
	}

	const fileType = MiscUtils.getFileType(filePath, true, "txt");
	const tempFilePath = MiscUtils.createRandomFileAndOpenInEditor(
		fileType,
		snippet,
	);

	if (!tempFilePath) {
		logger.error("error launching text editor");
		return false;
	}

	if (
		FileUtils.writeTextFile(filePath, FileUtils.readTextFile(tempFilePath)!)
	) {
		store.update();
		return true;
	}

	logger.error("failed to read/write files");
	return false;
}

export async function saveMultipleFiles(
	key: string,
	files: string[] | null = null,
	description: string | null = null,
): Promise<boolean> {
	/*
		(1) create snippet directory and copy the files (passed in args) to under it
		(2) SnippetRecord.structure<SnippetStructure> = { 
				filename: null, 
				type: DUMMY_NODE, 
				children: [
					{
						filename: <same as file #1>,
						type: FILE,
						children: null
					},
					{
						filename: <same as file #2>,
						type: FILE,
						children: null
					},
					...
				]
			}
	*/

	const logger = new Logger();

	if (!files) {
		logger.error("missing file paths");
		return false;
	}

	const store = new Store();

	if (store.doesSnippetKeyExist(key)) {
		logger.error("key already exists");
		return false;
	}

	// files contains possibly relative filenames, filePaths contain absolute filenames
	const filePaths = FileUtils.resolveFilePaths(files);

	// ensure all files exist before proceeding
	for (let i = 0; i < filePaths.length; ++i) {
		if (!FileUtils.doesFileExist(filePaths[i])) {
			logger.error(`file not found: ${files[i]}`);
			return false;
		}
	}

	// create snippet directory
	SnippetUtils.createSnippetDirectory(key);

	// copy each file
	const children: SnippetStructure[] = [];
	const parameters: Set<string> = new Set<string>();

	for (let i = 0; i < filePaths.length; ++i) {
		const filename = FileUtils.getFileNameFromPath(filePaths[i]);
		const newFilePath = Config.getStoragePath([key, filename]);

		const params: string[] = MiscUtils.getParametersFromFilename(filename);
		params.forEach((param: string) => {
			parameters.add(param);
		});

		FileUtils.copyFile(filePaths[i], newFilePath);

		children.push({
			filename: filename,
			type: SnippetStructureItemType.File,
			children: null,
		});
	}

	const structure: SnippetStructure = {
		filename: null,
		type: SnippetStructureItemType.DummyNode,
		children: children,
	};

	store.saveSnippet({
		key: key,
		description: description,
		type: SnippetType.MultiFile,
		structure: structure,
		parameters: Array.from(parameters),
	});

	store.update();
	logger.success("template saved");
	return true;
}

export async function saveDirectory(
	key: string,
	dirPath: string | null = null,
	description: string | null = null,
	preExtractScriptPath: string | null = null,
	postExtractScriptPath: string | null = null,
): Promise<boolean> {
	/*
		(1) create snippet directory and copy the directory (passed in args) to under it
		(2) SnippetRecord.structure<SnippetStructure> = { 
				filename: <name of the root directory>, 
				type: DIRECTORY, 
				children: [
					{
						filename: <file #1>,
						type: FILE,
						children: null
					},
					{
						filename: <file #2>,
						type: FILE,
						children: null
					},
					{
						filename: <sub-directory #1>,
						type: DIRECTORY,
						children: []
					},
					...
				]
			}
	*/

	const logger = new Logger();

	if (!dirPath) {
		logger.error("missing parameter: path to the directory");
		return false;
	}

	const store = new Store();

	if (store.doesSnippetKeyExist(key)) {
		logger.error("key already exists");
		return false;
	}

	// files contains possibly relative filenames, filePaths contain absolute filenames
	dirPath = FileUtils.resolveFilePaths([dirPath])[0];

	// ensure the source directory before proceeding
	if (!FileUtils.doesDirectoryExist(dirPath)) {
		logger.error("directory does not exist or you don't have read permissions");
		return false;
	}

	// create snippet directory
	SnippetUtils.createSnippetDirectory(key);

	// copy the directory
	const destPath = SnippetUtils.getSnippetDirectory(key);
	FileUtils.copyDirectory(dirPath, destPath);

	const triggerScripts = SnippetUtils.copyTriggerScripts(
		key,
		preExtractScriptPath,
		postExtractScriptPath,
	);

	const result: DirectoryStructure =
		await SnippetUtils.getDirectoryStructureFromPath(destPath);

	store.saveSnippet({
		key: key,
		description: description,
		type: SnippetType.Directory,
		structure: result.structure,
		parameters: Array.from(result.parameters),
		triggers: {
			preScript: triggerScripts.preScript,
			postScript: triggerScripts.postScript,
		},
	});

	store.update();
	logger.success("template saved");
	return true;
}

export async function cloneGitRepo(
	key: string,
	repoURL: string | null = null,
	description: string | null = null,
	preExtractScriptPath: string | null = null,
	postExtractScriptPath: string | null = null,
): Promise<boolean> {
	const logger = new Logger();

	if (!repoURL) {
		logger.error("git repo URL missing");
		return false;
	}

	const store = new Store();

	if (store.doesSnippetKeyExist(key)) {
		logger.error("key already exists");
		return false;
	}

	// create snippet directory
	SnippetUtils.createSnippetDirectory(key);

	const triggerScripts = SnippetUtils.copyTriggerScripts(
		key,
		preExtractScriptPath,
		postExtractScriptPath,
	);

	let repoName = repoURL.substring(1 + repoURL.lastIndexOf("/"));
	if (repoName.endsWith(".git"))
		repoName = repoName.substring(repoName.length - 4);

	const snippetDir = SnippetUtils.getSnippetDirectory(key);
	const repoLocalDir = Config.formPath([snippetDir, repoName]);
	FileUtils.createDirectory(repoLocalDir);

	const git: SimpleGit = simpleGit.simpleGit();

	try {
		logger.info(`Cloning into ${repoLocalDir}...`);
		await git.clone(repoURL, repoLocalDir);
		logger.info("Clone completed successfully!");
	} catch {
		logger.error("Clone failed");
		FileUtils.deleteDirectory(snippetDir);
		return false;
	}

	const result: DirectoryStructure =
		await SnippetUtils.getDirectoryStructureFromPath(repoLocalDir);

	store.saveSnippet({
		key: key,
		description: description,
		type: SnippetType.Directory,
		structure: result.structure,
		parameters: Array.from(result.parameters),
		triggers: {
			preScript: triggerScripts.preScript,
			postScript: triggerScripts.postScript,
		},
	});

	store.update();
	logger.success("template saved");
	return true;
}

export async function saveTree(
	key: string,
	description: string | null = null,
	preExtractScriptPath: string | null = null,
	postExtractScriptPath: string | null = null,
): Promise<boolean> {
	const cm = new ClipboardManager();
	const tree = (await cm.paste()).trim();
	const logger = new Logger();
	const store = new Store();

	if (store.doesSnippetKeyExist(key)) {
		logger.error("key already exists");
		return false;
	}

	// create snippet directory
	SnippetUtils.createSnippetDirectory(key);

	const triggerScripts = SnippetUtils.copyTriggerScripts(
		key,
		preExtractScriptPath,
		postExtractScriptPath,
	);

	const { structure, parameters } = MiscUtils.extractStructureFromTree(tree);

	//	console.log(JSON.stringify(struct, null, 2));
	if (!structure) {
		logger.error("invalid tree structure");
		return false;
	}

	store.saveSnippet({
		key: key,
		description: description,
		type: SnippetType.Directory,
		structure: structure,
		parameters: Array.from(parameters),
		triggers: {
			preScript: triggerScripts.preScript,
			postScript: triggerScripts.postScript,
		},
	});

	store.update();
	logger.success("tree saved");
	return true;
}
