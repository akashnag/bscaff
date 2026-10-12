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

import { execSync } from "child_process";
import * as nunjucks from "nunjucks";
import simpleGit, { SimpleGit } from "simple-git";
import pkg from "../../package.json" with { type: "json" };
import { Config } from "../core/config.js";
import { Settings } from "../core/settings.js";
import { Store } from "../core/store.js";
import { ConsoleIO } from "../io/io.js";
import { SaveGitRepoIO } from "../io/save-io.js";
import {
	ExtractTemplateIO,
	SaveTemplateIO,
	VerifyTemplateIO,
} from "../io/template-io.js";
import { YAMLParseError } from "../types/errors.js";
import {
	Template,
	TemplateAnswers,
	TemplateSourceType,
} from "../types/template-types.js";
import { FileTreeNode, SnapshotRecord, SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as ParamUtils from "../utils/param-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as SpecialFileIOUtils from "../utils/special-file-io.js";
import * as TemplateUtils from "../utils/template-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

// --------------------------------------------------------
// template save <zip-OR-repo-URL> [--source <git|zip|dir>]
// --------------------------------------------------------
export async function handleSaveTemplateCommand(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	source: string | undefined,
	filePath: string | undefined,
): Promise<boolean> {
	return await saveTemplate(key, description, tags, source, filePath);
}

export async function handleCreateTemplateFromDirectoryCommand(
	key: string | undefined,
	desc: string | undefined,
	tags: string | undefined,
	editConfigFile: boolean | undefined,
	fromPath: string,
): Promise<boolean> {
	if (!editConfigFile) editConfigFile = false;

	const io = new SaveTemplateIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	fromPath = FileUtils.resolvePath(fromPath);
	if (!FileUtils.doesDirectoryExist(fromPath)) {
		io.errorSourceDirectoryMissing(fromPath);
		return false;
	}

	const template: Template = {
		_min_bscaff_version: pkg.version,
		_exclude: Settings.get("exclude") ?? undefined,
		_include: Settings.get("include") ?? undefined,
		_skip_if_exists: [],
		_templates_suffix: ".jinja",
	};

	const templateContent: string = TemplateUtils.writeTemplate(
		template,
	) as string;

	const randFile = MiscUtils.createTempFile(
		"yml",
		templateContent,
		editConfigFile,
		false,
	);

	if (!randFile) {
		io.errorCreatingTempFile();
		return false;
	}

	if (!verifyTemplate(randFile, true, true)) {
		io.errorCreatingTemplateDueToInvalidTemplateFormat();
		return false;
	}

	const store = await Store.create();
	SnapshotUtils.createSnapshotDirectory(key);
	const snapshotDir = SnapshotUtils.getSnapshotDirectory(key);
	const localDir = FileUtils.copyDirectory(fromPath, snapshotDir);
	const templateConfigFilePath = FileUtils.formPath([
		localDir,
		Config.TEMPLATE_CONFIG_FILE,
	]);

	FileUtils.copyFile(randFile, templateConfigFilePath);

	const templateDir = template._subdirectory
		? FileUtils.formPath([localDir, template._subdirectory])
		: localDir;

	let structure, parameters, stats;

	try {
		({ structure, parameters, stats } =
			await TreeUtils.extractStructureFromDirectory(
				templateDir,
				{
					exclude: template._exclude,
					include: template._include,
					envOps: template._envops,
				},
				false,
			));
	} catch (err: any) {
		io.errorGeneric(
			"createTemplateFromDirectory: error extracting structure ==> " +
				err.toString(),
		);
		return false;
	}

	const tagList = tags ? tags.split(",") : undefined;
	const info: SnapshotRecord = {
		key: key,
		description: desc,
		type: SnapshotType.Template,
		tags: tagList,
		structure: structure ?? undefined,
		parameters: parameters ?? undefined,
		templateRootDir: FileUtils.getFileNameFromPath(fromPath),
		templateSource: {
			sourceType: "dir",
		},
	};
	store.save(info);

	store.update();
	io.successSnapshotTaken(
		key,
		MiscUtils.formatFileSize(stats.sizeInBytes),
		stats.fileCount,
		stats.dirCount,
		desc,
		tagList,
		"Template",
	);

	return true;
}

export async function handleVerifyTemplateCommand(
	templateDirPath: string,
): Promise<Template | null> {
	return await verifyTemplate(templateDirPath, false, false);
}

export async function handleUpdateTemplateCommand(
	key: string | undefined,
): Promise<boolean> {
	const io = new SaveTemplateIO();

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

	if (record.type !== SnapshotType.Template) {
		io.errorUnsupportedOperation(
			key,
			record.type,
			"Update template",
			SnapshotType.Template,
		);
		return false;
	}

	if (!record.templateSource || !record.templateSource.url) {
		io.errorCannotUpdateNonGitTemplate(key);
		return false;
	}

	const git: SimpleGit = simpleGit.simpleGit();
	const gitIO = new SaveGitRepoIO();

	gitIO.startFetchGitTag(record.templateSource.url);
	const remoteVersion = await getLatestRemoteTag(
		git,
		record.templateSource.url,
	);

	if (!remoteVersion) {
		gitIO.errorFetchingGitTag(record.templateSource.url);
		return false;
	}

	gitIO.doneFetchingGitTag();

	if (
		record.templateSource.version &&
		remoteVersion === record.templateSource.version
	) {
		io.successTemplateGitRepoAlreadyLatest(
			key,
			record.templateSource.url,
			record.templateSource.version,
		);
		return true;
	}

	store.delete(key);

	const retVal = await saveTemplate(
		record.key,
		record.description,
		record.tags ? record.tags.join(",") : undefined,
		"git",
		record.templateSource!.url,
	);

	if (retVal) {
		store.updateCreationTime(key, record.createdAt!); // set old time of creation
		store.update();

		io.successTemplateUpdated(key);
		return true;
	}

	return false;
}

export async function handleGenerateProjectFromTemplateCommand(
	key: string | undefined,
	dryRun: boolean | undefined,
	overwriteBehaviour: string | undefined,
	jsonParams: string | undefined,
	fromDir: string | undefined,
	fromZip: string | undefined,
	fromGit: string | undefined,
	toPath: string,
): Promise<boolean> {
	const io = new ExtractTemplateIO();

	if (fromZip && fromDir) {
		io.errorConflictingArgs("--from-zip", "--from-dir");
		return false;
	}

	if (fromZip && fromGit) {
		io.errorConflictingArgs("--from-zip", "--from-git");
		return false;
	}

	if (fromDir && fromGit) {
		io.errorConflictingArgs("--from-git", "--from-dir");
		return false;
	}

	if (key && (fromZip || fromDir || fromGit)) {
		if (fromZip) {
			io.errorConflictingArgs("--key", "--from-zip");
		} else if (fromDir) {
			io.errorConflictingArgs("--key", "--from-dir");
		} else {
			io.errorConflictingArgs("--key", "--from-git");
		}
		return false;
	}

	if (!key && !fromZip && !fromDir && !fromGit) {
		io.errorMissingParameter("--key");
		return false;
	}

	if (key) {
		return await generateProjectFromSavedTemplate(
			key,
			dryRun,
			overwriteBehaviour,
			jsonParams,
			toPath,
		);
	} else {
		return await generateProjectFromDirOrZipOrGitTemplate(
			fromDir,
			fromZip,
			fromGit,
			dryRun,
			overwriteBehaviour,
			jsonParams,
			toPath,
		);
	}
}

// ---------------- [helpers] --------------------

async function cloneGitRepoAndFetchTemplate(
	url: string,
	extractDir: string,
): Promise<{
	template: Template | null;
	templateDir: string;
	templateRootDirName: string;
	templateSource: {
		sourceType: TemplateSourceType;
		url?: string;
		version?: string;
	};
} | null> {
	let repoName = url.substring(1 + url.lastIndexOf("/")).trim();
	if (repoName.toLowerCase().endsWith(".git")) {
		repoName = repoName.substring(repoName.length - 4);
	}

	const localDir = FileUtils.formPath([extractDir, repoName]);
	const templateRootDirName = repoName;
	let templateSource: {
		sourceType: TemplateSourceType;
		url?: string;
		version?: string;
	} = { sourceType: "git" };
	let template: Template | null = null;

	FileUtils.createDirectory(localDir);

	const git: SimpleGit = simpleGit.simpleGit();
	const gitIO = new SaveGitRepoIO();

	try {
		gitIO.cloneStart(localDir);

		// fetch latest tag
		templateSource = {
			sourceType: "git" as TemplateSourceType,
			url: url,
			version: await getLatestRemoteTag(git, url),
		};

		// clone the latest tag if exists
		if (templateSource.version) {
			await git.clone(url, localDir, [
				"--branch",
				templateSource.version,
				"--single-branch",
			]);
		} else {
			await git.clone(url, localDir);
		}

		gitIO.cloneComplete();

		template = await verifyTemplate(localDir, true, false);
	} catch {
		gitIO.cloneFailed();
		FileUtils.deleteDirectory(localDir);
		return null;
	}

	return {
		template,
		templateDir: localDir,
		templateRootDirName,
		templateSource,
	};
}

async function extractZipAndFetchTemplate(
	filePath: string,
	extractDir: string,
	io: SaveTemplateIO,
): Promise<{
	template: Template | null;
	templateDir: string;
	templateRootDirName: string;
	templateSource: {
		sourceType: TemplateSourceType;
		url?: string;
		version?: string;
	};
} | null> {
	if (!FileUtils.doesFileExist(filePath)) {
		io.errorSourceFileMissing(filePath);
		return null;
	}

	if (!filePath.toLowerCase().trim().endsWith(".zip")) {
		io.errorExpectedZipFile(filePath);
		return null;
	}

	const zipRootDir = SpecialFileIOUtils.getZipRootDirectory(filePath);
	if (!zipRootDir) {
		io.invalidTemplateZipFile(filePath);
		return null;
	}

	// although verifyTemplate checks for correct filename, check it here before doing an expensive extract-zip operation
	if (
		!SpecialFileIOUtils.doesZipHaveFileUnderRootDirectory(
			filePath,
			Config.TEMPLATE_CONFIG_FILE,
			zipRootDir,
		)
	) {
		io.errorTemplateFileMissing(filePath, false);
		return null;
	}

	if (!SpecialFileIOUtils.extractZipFile(filePath, extractDir)) {
		io.errorExtractingZip(filePath);
		return null;
	}

	const localDir = FileUtils.formPath([extractDir, zipRootDir]);
	if (!FileUtils.doesDirectoryExist(localDir)) {
		io.errorGeneric("extractZipAndFetchTemplate::1");
		return null;
	}

	const templateRootDirName = zipRootDir;
	const template = await verifyTemplate(localDir, true, false);

	const templateSource = {
		sourceType: "zip" as TemplateSourceType,
	};

	return {
		template,
		templateSource,
		templateRootDirName,
		templateDir: localDir,
	};
}

async function copyTemplateDirAndFetchTemplate(
	dirPath: string,
	copyToDir: string,
	io: SaveTemplateIO,
): Promise<{
	template: Template | null;
	templateDir: string;
	templateRootDirName: string;
	templateSource: {
		sourceType: TemplateSourceType;
		url?: string;
		version?: string;
	};
} | null> {
	if (!FileUtils.doesDirectoryExist(dirPath)) {
		io.errorSourceDirectoryMissing(dirPath);
		return null;
	}

	// although verifyTemplate checks for correct filename, check it here before doing an expensive copy-dir operation
	const remoteTemplateConfigFile = FileUtils.formPath([
		dirPath,
		Config.TEMPLATE_CONFIG_FILE,
	]);

	if (!FileUtils.doesFileExist(remoteTemplateConfigFile)) {
		io.errorTemplateFileMissing(remoteTemplateConfigFile, false);
		return null;
	}

	const dirName = FileUtils.getPathAndFileName(dirPath).filename;
	FileUtils.copyDirectory(dirPath, copyToDir);
	const localDir = FileUtils.formPath([copyToDir, dirName]);
	const templateRootDirName = dirName;

	if (!FileUtils.doesDirectoryExist(localDir)) {
		io.errorGeneric("copyTemplateDirAndFetchTemplate::1");
		return null;
	}

	const template = await verifyTemplate(localDir, true, false);

	const templateSource = {
		sourceType: "dir" as TemplateSourceType,
	};

	return {
		template,
		templateSource,
		templateDir: localDir,
		templateRootDirName,
	};
}

async function saveTemplate(
	key: string | undefined,
	description: string | undefined,
	tags: string | undefined,
	source: string | undefined,
	filePath: string | undefined,
): Promise<boolean> {
	const io = new SaveTemplateIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	if (!filePath) {
		io.errorMissingParameter("template-path");
		return false;
	}

	const store = await Store.create();

	if (store.doesKeyExist(key)) {
		io.errorDuplicateKey(key);
		return false;
	}

	SnapshotUtils.createSnapshotDirectory(key);
	const snapshotDir = SnapshotUtils.getSnapshotDirectory(key);
	let localDir: string | undefined = undefined;
	let templateSource = undefined;
	let template: Template | null = null; // important: must be initialized to NULL, since after switch-case we are checking for this to return / proceed
	let templateRootDirName: string | undefined = undefined;
	let result;

	switch (source) {
		// --------------- git repo ------------------
		case "git":
			result = await cloneGitRepoAndFetchTemplate(filePath, snapshotDir);
			if (result) {
				({
					template,
					templateSource,
					templateRootDirName,
					templateDir: localDir,
				} = result);
			}
			break;

		// --------------- zip file ------------------
		case "zip":
			filePath = FileUtils.resolvePath(filePath);

			result = await extractZipAndFetchTemplate(filePath, snapshotDir, io);
			if (result) {
				({
					template,
					templateSource,
					templateRootDirName,
					templateDir: localDir,
				} = result);
			}
			break;

		// --------------- directory ------------------
		case "dir":
		default:
			filePath = FileUtils.resolvePath(filePath);

			result = await copyTemplateDirAndFetchTemplate(filePath, snapshotDir, io);
			if (result) {
				({
					template,
					templateSource,
					templateRootDirName,
					templateDir: localDir,
				} = result);
			}

			break;
	}

	if (!template || !localDir || !templateRootDirName || !templateSource) {
		FileUtils.deleteDirectory(snapshotDir);
		return false;
	}

	const tagList = tags ? tags.split(",") : undefined;

	const templateDir = template._subdirectory
		? FileUtils.formPath([localDir, template._subdirectory])
		: localDir;

	let structure, parameters, stats;
	try {
		({ structure, parameters, stats } =
			await TreeUtils.extractStructureFromDirectory(templateDir, {
				exclude: template._exclude,
				include: template._include,
			}));
	} catch (err: any) {
		io.errorGeneric(
			"saveTemplate: error extracting structure ==> " + err.toString(),
		);
		return false;
	}

	if (!structure) {
		FileUtils.deleteDirectory(snapshotDir);
		io.errorGeneric("saveTemplate::1");
		return false;
	}

	const info: SnapshotRecord = {
		key: key,
		description: description,
		type: SnapshotType.Template,
		tags: tagList,
		structure: structure,
		parameters: parameters ?? undefined,
		templateRootDir: templateRootDirName,
		templateSubDirectoryPath: template._subdirectory
			? template._subdirectory
			: undefined,
	};

	info.templateSource = templateSource;

	store.save(info);

	store.update();
	io.successSnapshotTaken(
		key,
		MiscUtils.formatFileSize(stats.sizeInBytes),
		stats.fileCount,
		stats.dirCount,
		description,
		tagList,
		"Template",
	);

	return true;
}

async function verifyTemplate(
	templateDirPath: string,
	suppressSuccessMsg: boolean,
	pathToConfigFile: boolean, // if true then 'templateDirPath' is path to the config file itself
): Promise<Template | null> {
	const io = new VerifyTemplateIO();

	try {
		if (!pathToConfigFile && !FileUtils.doesDirectoryExist(templateDirPath)) {
			io.errorSourceDirectoryMissing(templateDirPath);
			return null;
		}

		const filePath = pathToConfigFile
			? templateDirPath
			: FileUtils.formPath([templateDirPath, Config.TEMPLATE_CONFIG_FILE]);

		if (!FileUtils.doesFileExist(filePath)) {
			io.errorTemplateConfigFileMissing(filePath);
			return null;
		}

		const modTemplate = await TemplateUtils.readTemplateFile(filePath);

		// check YAML parsing errors
		if (!modTemplate) {
			io.errorParsingTemplateFileContent();
			return null;
		}

		// check template sub-directory exists (if specified)
		if (modTemplate._subdirectory) {
			const subDirPath = FileUtils.formPath([
				pathToConfigFile
					? FileUtils.getPathAndFileName(templateDirPath).path
					: templateDirPath,
				modTemplate._subdirectory,
			]);

			if (!FileUtils.doesDirectoryExist(subDirPath)) {
				io.warnTemplateSubdirectoryDoesNotExist(subDirPath);
			}
		}

		if (!suppressSuccessMsg) io.successTemplateVerified();
		return modTemplate;
	} catch (err: any) {
		io.errorDuringTemplateParsing(err as YAMLParseError);
		return null;
	}
}

async function generateProjectFromDirOrZipOrGitTemplate(
	fromDir: string | undefined,
	fromZip: string | undefined,
	fromGit: string | undefined,
	dryRun: boolean | undefined,
	overwriteBehaviour: string | undefined,
	jsonParams: string | undefined,
	toPath: string,
): Promise<boolean> {
	const io = new ExtractTemplateIO();
	const saveIO = new SaveTemplateIO();

	let localDir: string | undefined = undefined;
	let templateSource = undefined;
	let template: Template | null = null; // important: must be initialized to NULL, since after switch-case we are checking for this to return / proceed
	let templateRootDirName: string | undefined = undefined;
	let result;

	const tempDir = MiscUtils.createTempDirectory();
	if (!tempDir) {
		io.errorGeneric("generateProjectFromDirOrZipOrGitTemplate::1");
		return false;
	}

	if (fromGit) {
		result = await cloneGitRepoAndFetchTemplate(fromGit, tempDir);
		if (result) {
			({
				template,
				templateSource,
				templateRootDirName,
				templateDir: localDir,
			} = result);
		}
	} else if (fromZip) {
		fromZip = FileUtils.resolvePath(fromZip);

		result = await extractZipAndFetchTemplate(fromZip, tempDir, saveIO);
		if (result) {
			({
				template,
				templateSource,
				templateRootDirName,
				templateDir: localDir,
			} = result);
		}
	} else if (fromDir) {
		fromDir = FileUtils.resolvePath(fromDir);

		result = await copyTemplateDirAndFetchTemplate(fromDir, tempDir, saveIO);
		if (result) {
			({
				template,
				templateSource,
				templateRootDirName,
				templateDir: localDir,
			} = result);
		}
	}

	if (!template || !templateSource || !templateRootDirName || !localDir) {
		io.errorProjectGenerationAborted();
		return false;
	}

	let structure = null,
		parameters: string[] | null = null,
		stats;

	try {
		({ structure, parameters, stats } =
			await TreeUtils.extractStructureFromDirectory(localDir, {
				exclude: template._exclude,
				include: template._include,
			}));

		if (!structure) throw new Error("Could not extract directory structure!");
		if (!parameters) parameters = [];
	} catch (err: any) {
		io.errorGeneric(
			"generateProjectFromDirOrZipOrGitTemplate: error extracting structure ==> " +
				err.toString(),
		);
		return false;
	}

	return await generateProjectFromTemplateDirectory(
		localDir,
		structure,
		parameters,
		templateSource,
		dryRun,
		overwriteBehaviour,
		jsonParams,
		toPath,
	);
}

async function generateProjectFromSavedTemplate(
	key: string | undefined,
	dryRun: boolean | undefined,
	overwriteBehaviour: string | undefined,
	jsonParams: string | undefined,
	toPath: string,
): Promise<boolean> {
	const io = new ExtractTemplateIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	const store = await Store.create();
	const record = store.fetch(key);

	if (!record) {
		io.errorKeyNotFound(key);
		return false;
	}

	if (record.type !== SnapshotType.Template) {
		io.errorUnsupportedOperation(
			key,
			record.type,
			"generate-project",
			SnapshotType.Template,
		);
		return false;
	}

	if (!record.templateSource || !record.templateRootDir) {
		io.errorPossibleDataCorruption(
			"Missing 'templateSource' / 'templateRootDir' in snapshot record",
		);
		return false;
	}

	if (!overwriteBehaviour) overwriteBehaviour = "prompt";

	const snapshotDir = SnapshotUtils.getSnapshotDirectory(key);
	const pathToTemplateDir = FileUtils.formPath([
		snapshotDir,
		record.templateRootDir,
	]);

	return await generateProjectFromTemplateDirectory(
		pathToTemplateDir,
		record.structure!,
		record.parameters,
		record.templateSource,
		dryRun,
		overwriteBehaviour,
		jsonParams,
		toPath,
	);
}

async function generateProjectFromTemplateDirectory(
	pathToTemplateDir: string,
	structure: FileTreeNode[],
	parameters: string[] | undefined,
	templateSource: {
		sourceType: TemplateSourceType;
		url?: string;
		version?: string;
	},
	dryRun: boolean | undefined,
	overwriteBehaviour: string | undefined,
	jsonParams: string | undefined,
	toPath: string,
): Promise<boolean> {
	const io = new ExtractTemplateIO();

	const templateFile = FileUtils.formPath([
		pathToTemplateDir,
		Config.TEMPLATE_CONFIG_FILE,
	]);

	if (!FileUtils.doesFileExist(templateFile)) {
		io.errorCorruptedData("template-config-file");
		return false;
	}

	const template = await TemplateUtils.readTemplateFile(templateFile);
	if (!template) {
		io.errorReadingTemplateConfigFile(templateFile);
		return false;
	}

	if (
		dryRun &&
		(template._pre_generation_tasks || template._post_generation_tasks)
	) {
		io.errorCannotDryRunInPresenceOfTriggers();
		return false;
	}

	const templateSourceDir = template._subdirectory
		? FileUtils.formPath([pathToTemplateDir, template._subdirectory])
		: pathToTemplateDir;

	const engine = ParamUtils.createTemplateEngine(template._envops);
	const templateOptions = {
		exclude:
			template._exclude ??
			Settings.get("exclude") ??
			Settings.DEFAULT_SETTINGS.exclude,
		include:
			template._include ??
			Settings.get("include") ??
			Settings.DEFAULT_SETTINGS.include,
		templatesSuffix:
			template._templates_suffix ??
			Settings.get("templatesSuffix") ??
			Settings.DEFAULT_SETTINGS.templatesSuffix,
	};

	let paramValues: Record<string, any> = {};

	if (parameters && parameters.length > 0) {
		if (jsonParams) {
			const jsonData = JSON.parse(jsonParams);
			const missingItems = [];

			for (let i = 0; i < parameters.length; ++i) {
				if (!Object.hasOwn(jsonData, parameters[i])) {
					missingItems.push(parameters[i]);
				} else {
					paramValues[parameters[i]] = jsonData[parameters[i]];
				}
			}

			if (missingItems.length > 0) {
				io.errorJSONMissingParameters(missingItems);
				return false;
			}
		} else {
			paramValues = await io.promptForTemplateParameters(
				parameters,
				TemplateUtils.getCustomKeysFromTemplate(template),
				template,
			);
		}
	}

	io.infoBeginningProjectGeneration();

	if (!FileUtils.doesDirectoryExist(toPath)) {
		io.infoCreateDirectory(toPath);
		if (!dryRun) FileUtils.createDirectory(toPath);
	}

	if (!dryRun) {
		if (
			!(await executeTemplateTriggerTasks(
				"Pre",
				template._pre_generation_tasks,
				toPath,
				paramValues,
				engine,
				io,
			))
		) {
			io.errorTemplateExtractionFailed("PRE_GENERATION_TASKS_FAILED");
			return false;
		}
	}

	// ---------- create answers object/file -----------
	let templateAnswers: TemplateAnswers = {
		_src_type: templateSource.sourceType,
	};

	if (templateSource.sourceType === "git") {
		templateAnswers._url = templateSource.url;
		templateAnswers._version = templateSource.version;
	}

	for (const varName in paramValues) {
		templateAnswers[varName] = paramValues[varName];
	}

	const templateAnswersFile = FileUtils.formPath([
		toPath,
		Config.TEMPLATE_PROJECT_CONFIG_FILE,
	]);
	io.infoCreateFile(templateAnswersFile);
	if (!dryRun) {
		TemplateUtils.writeTemplateAnswers(templateAnswers, templateAnswersFile);
	}

	// ----------- process files ------------------
	const excludedDirs: string[] = [];

	for (let i = 0; i < structure.length; ++i) {
		const node = structure[i];

		const baseFileName = FileUtils.getFileNameFromPath(node.path);
		if (baseFileName === Config.TEMPLATE_CONFIG_FILE) continue;

		const nodePath = ParamUtils.replacePlaceholdersInFilePath(
			node.path,
			paramValues,
			templateOptions,
			engine,
		);

		if (ParamUtils.shouldFileOrDirectoryBeExcluded(nodePath, templateOptions)) {
			if (node.type === "dir") {
				excludedDirs.push(nodePath);
			}
			io.infoSkipFileOrDirectory(node.type, nodePath, "EXCLUDED");
			continue;
		}

		const hasMatchingPrefix: boolean = excludedDirs.some((prefix) =>
			nodePath.startsWith(prefix),
		);
		if (hasMatchingPrefix) {
			io.infoSkipFileOrDirectory(node.type, nodePath, "EXCLUDED");
			continue;
		}

		const sourcePath = FileUtils.formPath([templateSourceDir, node.path]);
		const targetPath = FileUtils.formPath([toPath, nodePath]);

		if (node.type === "dir") {
			if (!FileUtils.doesDirectoryExist(targetPath)) {
				io.infoCreateDirectory(targetPath);
				if (!dryRun) FileUtils.createDirectory(targetPath);
			}
		} else {
			if (FileUtils.doesFileExist(targetPath)) {
				if (overwriteBehaviour === "fail") {
					io.errorTemplateExtractionFailed("FILE_EXISTS", targetPath);
					return false;
				} else if (overwriteBehaviour === "skip") {
					io.infoSkipFileOrDirectory("file", targetPath, "FILE_EXISTS");
					continue;
				} else if (overwriteBehaviour === "prompt") {
					const overwrite = await io.promptForFileOverwrite(targetPath);
					if (!overwrite) {
						io.infoSkipFileOrDirectory("file", targetPath, "USER_SKIPPED");
						continue;
					}
				}
			}

			io.infoCreateFile(targetPath);
			if (!dryRun) {
				if (!FileUtils.copyFile(sourcePath, targetPath)) {
					io.errorCopyingFile(targetPath);
					io.errorTemplateExtractionFailed("FILE_COPY_ERROR", targetPath);
					return false;
				} else {
					const modContent =
						await ParamUtils.getModifiedFileContentPostPlaceholderReplacement(
							sourcePath, // use sourcePath to read the file (as otherwise .jinja extension will be lost in targetPath which will cause no replacement of placeholders as templatesSuffix wont match)
							paramValues,
							templateOptions,
							engine,
						);

					if (!modContent) {
						io.errorGeneric("generateProjectFromTemplate::1");
						return false;
					}

					if (!FileUtils.writeTextFile(targetPath, modContent)) {
						io.errorModifyingFileContents(targetPath);
						return false;
					}
				}
			}
		}
	}

	if (!dryRun) {
		if (
			!(await executeTemplateTriggerTasks(
				"Post",
				template._post_generation_tasks,
				toPath,
				paramValues,
				engine,
				io,
			))
		) {
			io.errorTemplateExtractionFailed("POST_GENERATION_TASKS_FAILED");
			return false;
		}
	}

	io.successTemplateProjectGenerated(toPath, template._post_generation_message);
	return true;
}

async function executeTemplateTriggerTasks(
	eventType: "Pre" | "Post",
	tasks: string[] | undefined,
	workingDir: string,
	paramValues: Record<string, any>,
	engine: nunjucks.Environment,
	io: ExtractTemplateIO,
): Promise<boolean> {
	if (!tasks) return true;
	if (!tasks || tasks.length === 0) return true;

	io.infoInitiatingAllGenerationTasks(eventType);
	let success = true;
	let count = 0;

	for (const rawTask of tasks) {
		let command: string;

		// Render template variables inside the command string
		try {
			command = engine.renderString(rawTask, paramValues);
		} catch (err: any) {
			io.errorInRenderingGenerationTaskCommand(rawTask, err.message);
			success = false;
			break;
		}

		// Skip empty or whitespace-only commands after rendering
		if (!command.trim()) continue;

		io.infoInitiatingGenerationTask(++count, command);

		// Execute command sequentially in workingDir
		try {
			execSync(command, {
				cwd: workingDir,
				stdio: "inherit",
				encoding: "utf-8",
			});
		} catch (err: any) {
			io.errorExecutingGenerationTask(command, workingDir, err.message);
			success = false;
			break;
		}

		io.infoCompletedGenerationTask();
	}

	if (success) {
		io.infoCompletedAllGenerationTasks(eventType);
		return true;
	} else {
		io.errorFailedToCompleteGenerationTasks(eventType);
		return false;
	}
}

async function getLatestRemoteTag(
	git: SimpleGit,
	repoURL: string,
): Promise<string | undefined> {
	const rawOutput = await git.listRemote([
		"--tags",
		"--sort=-v:refname",
		repoURL,
	]);

	// Extract all tag names, stripping out "refs/tags/" and dereference indicators ("^{}")
	const tags = rawOutput
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean)
		.map((line) => line.split(/\s+/)[1]) // Get the ref path (e.g. "refs/tags/v1.2.3")
		.filter((ref) => ref && !ref.endsWith("^{}")) // Exclude annotated tag commit pointers
		.map((ref) => ref.replace("refs/tags/", ""));

	// The first element in the array is the latest version tag
	return tags && tags.length > 0 ? tags[0] : undefined;
}
