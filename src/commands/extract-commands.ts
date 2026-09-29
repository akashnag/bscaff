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

import * as nunjucks from "nunjucks";
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
import * as ParamUtils from "../utils/param-utils.js";
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
	parameterValues: Record<string, any>,
): Promise<boolean> {
	if (!record.structure) return false;
	if (record.type !== SnapshotType.Files) return false;

	const io = new ExtractSnapshotIO();
	const engine = ParamUtils.createTemplateEngine();
	const templatingOptions = {
		exclude: Settings.get("exclude") ?? [],
		include: Settings.get("include") ?? [],
		templatesSuffix: Settings.get("templatesSuffix") ?? "",
	};

	for (let i = 0; i < record.structure.length; ++i) {
		if (record.structure[i].type !== "file") continue;
		if (partialRelativePath && record.structure[i].path !== partialRelativePath)
			continue;

		const relPath = ParamUtils.replacePlaceholdersInFileName(
			record.structure[i].path,
			parameterValues,
			templatingOptions,
			engine,
		);
		const targetPath = FileUtils.formPath([toPath, relPath]);
		const sourcePath = SnapshotUtils.getFileUnderSnapshot(
			key,
			record.structure[i].path,
		);

		if (
			!(await extractFile(
				io,
				dryRun,
				overwriteBehaviour,
				sourcePath,
				targetPath,
				parameterValues,
				templatingOptions,
				engine,
			))
		)
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
	parameterValues: Record<string, any>,
): Promise<boolean> {
	if (!record.structure) return false;
	if (record.type !== SnapshotType.Tree) return false;

	const io = new ExtractSnapshotIO();
	const engine = ParamUtils.createTemplateEngine();
	const templatingOptions = {
		exclude: Settings.get("exclude") ?? [],
		include: Settings.get("include") ?? [],
		templatesSuffix: Settings.get("templatesSuffix") ?? "",
	};

	for (let i = 0; i < record.structure.length; ++i) {
		const node = record.structure[i];

		if (
			partialRelativePath &&
			!isPathChild(partialRelativePath, node.path, node.type)
		) {
			continue;
		}

		const relPath = ParamUtils.replacePlaceholdersInFileName(
			node.path,
			parameterValues,
			templatingOptions,
			engine,
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
			if (
				!(await extractFile(
					io,
					dryRun,
					overwriteBehaviour,
					sourcePath,
					targetPath,
					parameterValues,
					templatingOptions,
					engine,
				))
			)
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
	parameterValues: Record<string, any>,
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

async function extractFile(
	io: ExtractSnapshotIO,
	dryRun: boolean,
	overwriteBehaviour: string,
	sourcePath: string,
	targetPath: string,
	parameterValues?: Record<string, any>,
	options?: {
		exclude?: string[];
		include?: string[];
		templatesSuffix?: string;
	},
	engine?: nunjucks.Environment,
): Promise<boolean> {
	const exists = FileUtils.doesFileExist(targetPath);

	let overwrite = false;

	if (!exists) {
		io.infoFileCreate(targetPath);
	} else {
		switch (overwriteBehaviour) {
			case "prompt":
				overwrite = await io.promptForFileOverwrite(targetPath);
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

	// NOTE: targetPath must be already parameter-replaced (considering include, exclude and templatesSuffix) before calling this function
	if (!dryRun && (!exists || overwrite)) {
		if (exists) FileUtils.deleteFile(targetPath);

		if (parameterValues && options && engine) {
			const content = await ParamUtils.replacePlaceholdersInFileContent(
				sourcePath,
				parameterValues,
				options,
				engine,
			);

			if (!content) {
				io.errorGeneric("extractFile::1");
				return false;
			}

			FileUtils.writeTextFile(targetPath, content);
		} else {
			FileUtils.copyFile(sourcePath, targetPath);
		}
	}

	return true;
}

// ---------------------- [private] --------------------------------
/*
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
