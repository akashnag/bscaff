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

import { Store } from '../core/store.js';
import { FileUtils } from '../utils/file-utils.js';
import { Logger } from '../utils/logger.js';
import { RecursionResult, SnippetStructure, SnippetStructureItemType, SnippetType } from '../types/types.js';
import { Config } from '../utils/config.js';
import { MiscUtils } from '../utils/misc.js';
import { SnippetUtils } from '../utils/snippet.js';
import simpleGit, { SimpleGit } from 'simple-git';

export class SaveSnippet {
	static async saveTextFromFile(key: string, filePath: string | null = null, description: string | null = null): Promise<boolean> {
		/*
			(1) get the file type from filePath
			(2) create snippet directory and create a new file under it (with name = <Config.SNIPPET_TEXT_FILE>, and extension = filetype identified in step 1)
			(3) SnippetRecord.structure<SnippetStructure> = { filename: as in step-2, type: FILE, children: null, loc: as computed }
		*/
		
		if(!filePath) {
			Logger.error("missing file path");
			return false;
		}

		filePath = FileUtils.resolveFilePaths([ filePath ])[0];

		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		const snippet = await FileUtils.readSnippetFromFile(filePath);
		if(!snippet) {
			Logger.error("cannot read file: ensure it exists, is a text file and you have read permissions");
			return false;
		}

		const fileType = MiscUtils.getFileType(filePath, true, "txt");
		
		SnippetUtils.createSnippetDirectory(key);
		SnippetUtils.writeContentToSnippetFile(snippet, key, `${Config.SNIPPET_TEXT_FILE}${fileType}`);

		const structure: SnippetStructure = {
			filename: `${Config.SNIPPET_TEXT_FILE}${fileType}`,
			type: SnippetStructureItemType.File,
			loc: MiscUtils.countLOC(snippet),
			children: null
		};

		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.Text,
			structure: structure,
			parameters: null
		});

		store.update();
		Logger.success("snippet saved");
		return true;
	}

	static async saveFile(key: string, filePath: string | null = null, description: string | null = null): Promise<boolean> {
		/*
			(1) create snippet directory and create a new file under it (with name same as in filePath)
			(2) SnippetRecord.structure<SnippetStructure> = { filename: as in step-1, type: FILE, children: null, loc: as computed }
		*/

		if(!filePath) {
			Logger.error("missing file path");
			return false;
		}
		
		filePath = FileUtils.resolveFilePaths([ filePath ])[0];

		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		if(!FileUtils.doesFileExist(filePath)) {
			Logger.error("file not found");
			return false;
		}

		const filename = FileUtils.getFileNameFromPath(filePath);

		SnippetUtils.createSnippetDirectory(key);
		FileUtils.copyFile(
			filePath,
			Config.getStoragePath([ key, filename ])
		);

		const structure: SnippetStructure = {
			filename: filename,
			type: SnippetStructureItemType.File,
			loc: await MiscUtils.countLOCFromFile(filePath),
			children: null
		};

		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.File,
			structure: structure,
			parameters: null
		});

		store.update();
		Logger.success("snippet saved");
		return true;
	}

	static async saveLiveInput(key: string, fileType: string = "txt", description: string | null = null): Promise<boolean> {
		/*
			(1) get the file type from command-line args, or 'txt' if omitted by user
			(2) create snippet directory and create a new file under it (with name = <Config.SNIPPET_TEXT_FILE>, and extension = filetype identified in step 1)
			(3) SnippetRecord.structure<SnippetStructure> = { filename: as in step-2, type: FILE, children: null, loc: as computed }
		*/

		const path = MiscUtils.createRandomFileAndOpenInEditor(fileType);
		if(!path) {
			Logger.error("could not launch text editor");
			return false;
		}
		const success = await SaveSnippet.saveTextFromFile(key, path, description);
		if(success) return FileUtils.deleteFile(path);
		return false;
	}

	static async saveURL(key: string, url: string, description: string | null = null): Promise<boolean> {
		/*
			(1) create snippet directory and create a new file under it (with name = <Config.SNIPPET_TEXT_FILE>, and extension = '.url')
			(2) SnippetRecord.structure<SnippetStructure> = { filename: as in step-1, type: FILE, children: null, loc: 1 }
		*/

		if(!url) {
			Logger.error("URL missing");
			return false;
		} else {
			url = url.trim();
		}
		
		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		SnippetUtils.createSnippetDirectory(key);
		SnippetUtils.writeContentToSnippetFile(url, key, `${Config.SNIPPET_TEXT_FILE}.url`);

		const structure: SnippetStructure = {
			filename: `${Config.SNIPPET_TEXT_FILE}.url`,
			type: SnippetStructureItemType.File,
			loc: 1,
			children: null
		};

		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.URL,
			structure: structure,
			parameters: null
		});

		store.update();
		Logger.success("URL saved");
		return true;
	}

	static async editSnippetContent(key: string): Promise<boolean> {
		const store = new Store();

		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("snippet not found");
			return false;
		}

		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
			Logger.error("can only edit text/file/URLs");
			return false;
		}
		
		const filePath = SnippetUtils.getFileUnderSnippet(
			key,
			record.structure.filename!
		);

		const snippet = await FileUtils.readSnippetFromFile(filePath);

		if(!snippet) {
			Logger.error("error reading data");
			return false;
		}

		if(record.type == SnippetType.URL) {
			console.log(`Current URL: ${snippet.trim()}`);
			
			const newURL = await MiscUtils.prompt('Enter new URL (press Enter to abort): ');
			
			if(newURL.length == 0) {
				Logger.success("update aborted");
				return true;
			}

			if(!FileUtils.writeTextFile(filePath, newURL)) {
				Logger.error("error updating URL");
				return false;
			}

			Logger.success("URL updated");
			return true;
		}

		const fileType = MiscUtils.getFileType(filePath, true, "txt");
		const tempFilePath = MiscUtils.createRandomFileAndOpenInEditor(fileType, snippet);

		if(!tempFilePath) {
			Logger.error("error launching text editor");
			return false;
		}

		if(FileUtils.writeTextFile(filePath, FileUtils.readTextFile(tempFilePath)!)) {		
			store.update();
			return true;
		}

		Logger.error("failed to read/write files");
		return false;
	}

	static async saveMultipleFiles(key: string, files: string[] | null = null, description: string | null = null): Promise<boolean> {
		/*
			(1) create snippet directory and copy the files (passed in args) to under it
			(2) SnippetRecord.structure<SnippetStructure> = { 
					filename: null, 
					type: DUMMY_NODE, 
					children: [
						{
							filename: <same as file #1>,
							type: FILE,
							children: null,
							loc: as computed
						},
						{
							filename: <same as file #2>,
							type: FILE,
							children: null,
							loc: as computed
						},
						...
					], 
					loc: null 
				}
		*/

		if(!files) {
			Logger.error("missing file paths");
			return false;
		}

		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		// files contains possibly relative filenames, filePaths contain absolute filenames
		const filePaths = FileUtils.resolveFilePaths(files);

		// ensure all files exist before proceeding
		for(let i = 0; i < filePaths.length; ++i) {
			if(!FileUtils.doesFileExist(filePaths[i])) {
				Logger.error(`file not found: ${files[i]}`);
				return false;
			}
		}

		// create snippet directory
		SnippetUtils.createSnippetDirectory(key);
		
		// copy each file
		const children: SnippetStructure[] = [];
		const parameters: Set<string> = new Set<string>();

		for(let i = 0; i < filePaths.length; ++i) {
			const filename = FileUtils.getFileNameFromPath(filePaths[i]);
			const newFilePath = Config.getStoragePath([ key, filename ]);

			const params: string[] = MiscUtils.getParametersFromFilename(filename);
			params.forEach((param: string) => {
				parameters.add(param);
			});

			FileUtils.copyFile(
				filePaths[i],
				newFilePath
			);

			children.push({
				filename: filename,
				type: SnippetStructureItemType.File,
				loc: await MiscUtils.countLOCFromFile(newFilePath),
				children: null
			});
		}
		
		const structure: SnippetStructure = {
			filename: null,
			type: SnippetStructureItemType.DummyNode,
			loc: null,
			children: children
		};

		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.MultiFile,
			structure: structure,
			parameters: Array.from(parameters)
		});

		store.update();
		Logger.success("template saved");
		return true;
	}

	static async saveDirectory(
		key: string, 
		dirPath: string | null = null, 
		description: string | null = null,
		preExtractScriptPath: string | null = null,
		postExtractScriptPath: string | null = null
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
							children: null,
							loc: as computed
						},
						{
							filename: <file #2>,
							type: FILE,
							children: null,
							loc: as computed
						},
						{
							filename: <sub-directory #1>,
							type: DIRECTORY,
							children: [],
							loc: null
						},
						...
					], 
					loc: null 
				}
		*/
		
		if(!dirPath) {
			Logger.error("missing parameter: path to the directory");
			return false;
		}

		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		// files contains possibly relative filenames, filePaths contain absolute filenames
		dirPath = FileUtils.resolveFilePaths([dirPath])[0];

		// ensure the source directory before proceeding
		if(!FileUtils.doesDirectoryExist(dirPath)) {
			Logger.error("directory does not exist or you don't have read permissions");
			return false;
		}

		// create snippet directory
		SnippetUtils.createSnippetDirectory(key);
		
		// copy the directory
		const destPath = SnippetUtils.getSnippetDirectory(key);
		FileUtils.copyDirSync(dirPath, destPath);

		const triggerScripts = SaveSnippet.copyTriggerScripts(
			key,
			preExtractScriptPath,
			postExtractScriptPath
		);

		const result: RecursionResult = await SaveSnippet.processDirectory(destPath);
		
		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.Directory,
			structure: result.structure,
			parameters: Array.from(result.parameters),
			triggers: {
				preScript: triggerScripts.preScript,
				postScript: triggerScripts.postScript
			}
		});

		store.update();
		Logger.success("template saved");
		return true;
	}

	static async cloneGitRepo(
		key: string, 
		repoURL: string | null = null, 
		description: string | null = null,
		preExtractScriptPath: string | null = null,
		postExtractScriptPath: string | null = null
	): Promise<boolean> {
		if(!repoURL) {
			Logger.error("git repo URL missing");
			return false;
		}
		
		const store = new Store();

		if(store.doesSnippetKeyExist(key)) {
			Logger.error("key already exists");
			return false;
		}
		
		// create snippet directory
		SnippetUtils.createSnippetDirectory(key);

		const triggerScripts = SaveSnippet.copyTriggerScripts(
			key,
			preExtractScriptPath,
			postExtractScriptPath
		);

		let repoName = repoURL.substring(1 + repoURL.lastIndexOf('/'));
		if(repoName.endsWith('.git')) repoName = repoName.substring(repoName.length - 4);

		const snippetDir = SnippetUtils.getSnippetDirectory(key);
		const repoLocalDir = Config.formPath([ snippetDir, repoName ]);
		FileUtils.createDirectory(repoLocalDir);
		
		const git: SimpleGit = simpleGit.simpleGit();

		try {
			Logger.info(`Cloning into ${repoLocalDir}...`);
			await git.clone(repoURL, repoLocalDir);
			Logger.info('Clone completed successfully!');
		} catch {
			Logger.error('Clone failed');
			FileUtils.deleteDirectory(snippetDir);
			return false;
		}

		const result: RecursionResult = await SaveSnippet.processDirectory(repoLocalDir);
		
		store.saveSnippet({
			key: key,
			description: description,
			type: SnippetType.Directory,
			structure: result.structure,
			parameters: Array.from(result.parameters),
			triggers: {
				preScript: triggerScripts.preScript,
				postScript: triggerScripts.postScript
			}
		});

		store.update();
		Logger.success("template saved");
		return true;
	}

	// ------------------------ [private] -------------------------------

	private static async processDirectory(dirPath: string): Promise<RecursionResult> {
		const parameters = new Set<string>();

		async function walk(currentPath: string): Promise<SnippetStructure> {
			const name = FileUtils.getFileNameFromPath(currentPath);

			// Extract parameters from the current file or directory name
			const params = MiscUtils.getParametersFromFilename(name);
			params.forEach((param: string) => parameters.add(param));

			// Check if the current item is a directory or a file
			const isDir = FileUtils.doesDirectoryExist(currentPath);

			if(isDir) {
				// Read all direct children inside the folder
				const entryNames = FileUtils.readDirectoryContents(currentPath);
				const children: SnippetStructure[] = [];

				for (const entryName of entryNames) {
					const childPath = Config.formPath([ currentPath, entryName ]);
					
					// Recursively walk into each child item
					const childStructure = await walk(childPath);
					children.push(childStructure);
				}

				return {
					filename: name,
					type: SnippetStructureItemType.Directory,
					loc: null,
					children: children
				};
			} else {
				const loc = await MiscUtils.countLOCFromFile(currentPath);
				return {
					filename: name,
					type: SnippetStructureItemType.File,
					loc: loc,
					children: null
				};
			}
		}

		// Start the recursive traversal from root dirPath
		const rootStructure = await walk(dirPath);

		return {
			structure: rootStructure,
			parameters: parameters
		};
	}

	private static copyTriggerScripts(key: string, preExtractScript: string | null = null, postExtractScript: string | null = null): { preScript: string | null, postScript: string | null } {
		const snippetDir = SnippetUtils.getSnippetDirectory(key);
		const retVal: { preScript: string | null, postScript: string | null } = { preScript: null, postScript: null };

		if(preExtractScript && FileUtils.doesFileExist(preExtractScript)) {
			const fileType = MiscUtils.getFileType(preExtractScript, true, "");
			FileUtils.copyFile(preExtractScript, Config.formPath([ snippetDir, `pre-script${fileType}` ]));
			retVal.preScript = `pre-script${fileType}`;
		}

		if(postExtractScript && FileUtils.doesFileExist(postExtractScript)) {
			const fileType = MiscUtils.getFileType(postExtractScript, true, "");
			FileUtils.copyFile(postExtractScript, Config.formPath([ snippetDir, `post-script${fileType}` ]));
			retVal.postScript = `post-script${fileType}`;
		}

		return retVal;
	}
}
