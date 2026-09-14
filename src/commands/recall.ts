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
import { SnippetRecord, SnippetType } from "../types/types.js";
import { Config } from "../utils/config.js";
import { FileUtils } from "../utils/file-utils.js";
import { Logger } from "../utils/logger.js";
import { MiscUtils } from "../utils/misc.js";
import { SnippetUtils } from "../utils/snippet.js";

export class RecallSnippet {
	static async copySnippetToMemory(key: string): Promise<boolean> {
		const cm = new ClipboardManager();

		try {
			const store = new Store();
			if(!store.doesSnippetKeyExist(key)) {
				Logger.error("key not found");
				return false;
			}
			
			const record = store.fetchSnippetRecord(key);
			if(!record) {
				Logger.error("can't fetch record");
				return false;
			}

			if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
				Logger.error("can only use snippets of type text/file/URL");
				return false;
			}

			const snippet = await FileUtils.readSnippetFromFile(
				SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
			);

			if(!snippet) {
				Logger.error("error reading snippet");
				return false;
			}
	
			cm.copy(snippet);
			Logger.success("snippet copied to clipboard");
			return true;
		} catch {
			Logger.error("unknown error encountered in <copySnippetToMemory>");
			return false;
		}
	}

	static async openSnippet(key: string): Promise<boolean> {
		const store = new Store();
		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		let retVal = false;
		if(record.type == SnippetType.URL) {	
			// if URL then open URL via web browser
			const url = await FileUtils.readSnippetFromFile(
				SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
			);

			if(!url) {
				Logger.error("error reading URL");
				return false;
			}

			retVal = await MiscUtils.executeCommand(`google-chrome ${url}`);
			if(retVal) {
				Logger.success(`URL launched: ${url}`);
				retVal = true;
			}
		} else if(record.type == SnippetType.File || record.type == SnippetType.Text) {
			// if text/file, open it in a text editor
			const filePath = SnippetUtils.getFileUnderSnippet(key, record.structure.filename!);
			const snippet = await FileUtils.readSnippetFromFile(filePath);

			if(!snippet) {
				Logger.error("error reading snippet");
				return false;
			}
	
			const fileType = MiscUtils.getFileType(filePath);
			const tempFile = MiscUtils.createRandomFileAndOpenInEditor(fileType, snippet);
			if(!tempFile) {
				Logger.error("error launching text editor");
			} else {
				retVal = true;
			}
		} else {
			Logger.error("can only open snippets of type text/file/url");
		}

		return retVal;
	}

	static async appendOrPrependToFile(key: string, mode: 'append' | 'prepend', paths: string[]): Promise<boolean> {
		const store = new Store();
		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
			Logger.error("can only use snippets of type text/file/URL");
			return false;
		}

		const snippet = await FileUtils.readSnippetFromFile(
			SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
		);

		if(!snippet) {
			Logger.error("error reading snippet");
			return false;
		}

		// paths contains possibly relative filenames, filePaths contain absolute filenames
		const filePaths = FileUtils.resolveFilePaths(paths);

		let c: number = 0;
		for(let i: number = 0; i < paths.length; ++i) {
			const filePath = filePaths[i];
			if(!FileUtils.doesFileExist(filePath)) {
				Logger.error(`file not found, skipping: ${paths[i]}`);
			} else {
				let retVal = false;
				if(mode == 'append')
					retVal = FileUtils.appendToTextFile(filePath, snippet);
				else
					retVal = FileUtils.prependToTextFile(filePath, snippet);

				if(!retVal) {
					Logger.error(`error writing to file: ${paths[i]}`);
				} else {
					++c;
				}
			}
		}

		Logger.success(`${c} files updated`);
		return true;
	}

	static async displaySnippet(key: string): Promise<boolean> {
		const store = new Store();
		
		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type != SnippetType.Text && record.type != SnippetType.File && record.type != SnippetType.URL) {
			Logger.error("can only use snippets of type text/file/URL");
			return false;
		}

		const snippet = await FileUtils.readSnippetFromFile(
			SnippetUtils.getFileUnderSnippet(key, record.structure.filename!)
		);

		if(!snippet) {
			Logger.error("error reading snippet");
			return false;
		}

		console.log(snippet);
		return true;
	}

	static async listAllSnippets(): Promise<boolean> {
		const store = new Store();
		const data = store.getList();
		console.table(data);
		return true;
	}

	static async listSnippetFiles(key: string): Promise<boolean> {
		const store = new Store();

		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		if(record.type == SnippetType.Directory || record.type == SnippetType.MultiFile) {	
			// record.structure.filename will be null here, so iterate over its children
			console.log(SnippetUtils.drawSnippetFileTree(record.structure));
		} else if(record.type == SnippetType.File) {
			console.table([{
				key: record.key,
				type: record.type.toString(),
				filename: record.structure.filename,
				loc: record.structure.loc,
				updated: record.modifiedAt
			}]);
		} else {
			console.table(store.getList(key));
		}

		return true;
	}

	static async extractSnippet(key: string, path: string | null = null, overwrite: boolean = false): Promise<boolean> {
		if(!path) {
			Logger.error("missing path");
			return false;
		}
		
		const store = new Store();
		
		if(!store.doesSnippetKeyExist(key)) {
			Logger.error("key not found");
			return false;
		}
		
		const record = store.fetchSnippetRecord(key);
		if(!record) {
			Logger.error("can't fetch record");
			return false;
		}

		const paramValues: Record<string, string> = {};
		if(record.parameters) {
			for(const param of record.parameters) {
				paramValues[param] = await MiscUtils.prompt(`Enter value for parameter '${param}': `);
			}
		}

		// resolve paths
		path = FileUtils.resolveFilePaths([ path ])[0];

		if(record.type == SnippetType.File) {
			const localFilePath: string = SnippetUtils.getFileUnderSnippet(key, record.structure.filename!);
			let shouldOverwrite: boolean = false;
			const fileExists: boolean = FileUtils.doesFileExist(path);

			if(fileExists && !overwrite) {
				shouldOverwrite = ((await MiscUtils.prompt(`Overwrite (Y/N)? `)).toLowerCase() == 'y');
			}

			if(!fileExists || overwrite || shouldOverwrite) {
				if((!fileExists || FileUtils.deleteFile(path)) && FileUtils.copyFile(localFilePath, path)) {
					Logger.success(`file extracted to: ${path}`);
					return true;
				} else {
					Logger.error("could not extract file to destination");
					return false;
				}
			} else {
				Logger.info("skipping");
			}

			return true;
		} else if(record.type == SnippetType.MultiFile) {
			return await RecallSnippet.extractMultiFileTemplate(key, record, path, overwrite, paramValues);
		} else if(record.type == SnippetType.Directory) {
			return await RecallSnippet.extractDirectoryTemplate(key, record, path, overwrite, paramValues);
		} else {
			Logger.error("can only use snippets of type file/multi-file/directory/github-template");
			return false;
		}
	}

	// ------------------------------------------------------

	private static async extractMultiFileTemplate(key: string, record: SnippetRecord, path: string, overwrite: boolean, paramValues: Record<string, string>): Promise<boolean> {
		if(!record.structure.children) return false;
		
		const filesToExtract: { filename: string; path: string }[] = [];
		for(let i = 0; i < record.structure.children.length; ++i) {
			filesToExtract.push({
				filename: record.structure.children[i].filename!,
				path: SnippetUtils.getFileUnderSnippet(key, record.structure.children[i].filename!)
			});
		}
		
		for(let i = 0; i < filesToExtract.length; ++i) {
			const destPath: string = Config.formPath([ path, filesToExtract[i].filename ]);
			const fileExists: boolean = FileUtils.doesFileExist(destPath);
			let shouldOverwrite: boolean = false;

			if(fileExists && !overwrite) {
				shouldOverwrite = ((await MiscUtils.prompt(`Overwrite '${filesToExtract[i].filename}' (Y/N)? `)).toLowerCase() == 'y');
			}

			if(!fileExists || overwrite || shouldOverwrite) {
				if((!fileExists || FileUtils.deleteFile(destPath)) && FileUtils.copyFile(filesToExtract[i].path, destPath)) {
					MiscUtils.replacePlaceholdersInFile('file', destPath, paramValues);
					Logger.success(`file extracted to: ${path}`);
					return true;
				} else {
					Logger.error("could not extract file to destination");
					return false;
				}
			} else {
				Logger.info("skipping");
			}
		}

		return true;
	}

	private static async extractDirectoryTemplate(key: string, record: SnippetRecord, path: string, overwrite: boolean, paramValues: Record<string, string>): Promise<boolean> {
		// get root directory
		const rootDirName: string = record.structure.filename!;
		const concretizedRootDirName = MiscUtils.replacePlaceholdersInText(rootDirName, paramValues);
		const sourceRootDirPath: string = Config.formPath([ SnippetUtils.getSnippetDirectory(key), rootDirName ]);
		const destRootDirPath: string = Config.formPath([ path, rootDirName ]);
		
		if(FileUtils.doesDirectoryExist(destRootDirPath) && !overwrite) {
			const shouldOverwrite = ((await MiscUtils.prompt(`Overwrite '${concretizedRootDirName}' and any of its contents (Y/N)? `)).toLowerCase() == 'y');
			if(!shouldOverwrite) return true;
		} else {
			// create directory parent
			FileUtils.createDirectory(path);
		}

		// execute pre-extraction hooks
		RecallSnippet.executeTriggers(
			'pre', 
			key, 
			path, 
			record.triggers,
			MiscUtils.replacePlaceholdersInText(destRootDirPath, paramValues)		// the would-be final directory (after replacing params)
		);

		// copy the directory as-is (without replacing params)
		FileUtils.copyDirSync(sourceRootDirPath, destRootDirPath);

		// Recursively process files and folders to replace placeholders
        function processPath(currentPath: string): void {
            // Read entries before processing
            const entries = FileUtils.readDirectoryContents(currentPath);

            for (const entry of entries) {
                const entryPath = Config.formPath([ currentPath, entry ]);

                if (FileUtils.doesDirectoryExist(entry)) {
                    // Recurse into subdirectories first (bottom-up traversal)
                    processPath(entryPath);
                    // Rename the directory using your library function
                    MiscUtils.replacePlaceholdersInFile('directory', entryPath, paramValues);
                } else if (FileUtils.doesFileExist(entry)) {
                    // Rename file AND replace contents
                    MiscUtils.replacePlaceholdersInFile('file', entryPath, paramValues);
                }
            }
        }

        // Process all nested items inside the target root directory
        processPath(destRootDirPath);

        // Finally, rename the root directory itself if needed
        const renamedDestDir = MiscUtils.replacePlaceholdersInFile('directory', destRootDirPath, paramValues);

		// execute post-extraction hooks
		RecallSnippet.executeTriggers(
			'post', 
			key, 
			renamedDestDir, 
			record.triggers
		);

		Logger.success("directory extracted");
		return true;
	}

	// ------------------------------ [private] ------------------------------

	private static executeTriggers(
		mode: 'pre' | 'post', 
		key: string, 
		workingDir: string, 
		triggers: { preScript: string | null, postScript: string | null } | undefined,
		destDir: string | undefined = undefined
	) {
		if(!triggers) return;

		const snippetDir = SnippetUtils.getSnippetDirectory(key);

		if(mode == 'pre' && triggers.preScript) {
			const preScriptPath = Config.formPath([ snippetDir, triggers.preScript ]);
			MiscUtils.executeScript(preScriptPath, workingDir, destDir);
		}

		if(mode == 'post' && triggers.postScript) {
			const postScriptPath = Config.formPath([ snippetDir, triggers.postScript ]);
			MiscUtils.executeScript(postScriptPath, workingDir);
		}
	}
}