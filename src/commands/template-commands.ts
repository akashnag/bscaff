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
import { SnapshotRecord, SnapshotType } from "../types/types.js";
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
export async function saveTemplate(
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
	let template: Template | null = null;
	let templateRootDir: string | undefined = undefined;

	switch (source) {
		// --------------- git repo ------------------
		case "git":
			// filePath is a Git URL
			let repoName = filePath.substring(1 + filePath.lastIndexOf("/")).trim();
			if (repoName.toLowerCase().endsWith(".git")) {
				repoName = repoName.substring(repoName.length - 4);
			}

			localDir = FileUtils.formPath([snapshotDir, repoName]);
			templateRootDir = repoName;

			FileUtils.createDirectory(localDir);

			const git: SimpleGit = simpleGit.simpleGit();
			const gitIO = new SaveGitRepoIO();

			try {
				gitIO.cloneStart(localDir);

				// fetch latest tag
				templateSource = {
					sourceType: "git" as TemplateSourceType,
					url: filePath,
					version: await getLatestRemoteTag(git, filePath),
				};

				// clone the latest tag if exists
				if (templateSource.version) {
					await git.clone(filePath, localDir, [
						"--branch",
						templateSource.version,
						"--single-branch",
					]);
				} else {
					await git.clone(filePath, localDir);
				}

				gitIO.cloneComplete();

				template = await verifyTemplate(localDir, true);
			} catch {
				gitIO.cloneFailed();
				FileUtils.deleteDirectory(snapshotDir);
				return false;
			}
			break;

		// --------------- zip file ------------------
		case "zip":
			// filePath is path to a zip file
			filePath = FileUtils.resolvePath(filePath);

			if (!FileUtils.doesFileExist(filePath)) {
				io.errorSourceFileMissing(filePath);
				return false;
			}

			if (!filePath.toLowerCase().trim().endsWith(".zip")) {
				FileUtils.deleteDirectory(snapshotDir);
				io.errorExpectedZipFile(filePath);
				return false;
			}

			const zipRootDir = SpecialFileIOUtils.getZipRootDirectory(filePath);
			if (!zipRootDir) {
				FileUtils.deleteDirectory(snapshotDir);
				io.invalidTemplateZipFile(filePath);
				return false;
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
				FileUtils.deleteDirectory(snapshotDir);
				return false;
			}

			if (!SpecialFileIOUtils.extractZipFile(filePath, snapshotDir)) {
				io.errorExtractingZip(filePath);
				FileUtils.deleteDirectory(snapshotDir);
				return false;
			}

			localDir = FileUtils.formPath([snapshotDir, zipRootDir]);
			if (!FileUtils.doesDirectoryExist(localDir)) {
				io.errorGeneric("saveTemplate::1");
				return false;
			}

			templateRootDir = zipRootDir;
			template = await verifyTemplate(localDir, true);

			templateSource = {
				sourceType: "zip" as TemplateSourceType,
			};

			break;

		// --------------- directory ------------------
		case "dir":
		default:
			filePath = FileUtils.resolvePath(filePath);

			if (!FileUtils.doesDirectoryExist(filePath)) {
				FileUtils.deleteDirectory(snapshotDir);
				io.errorSourceDirectoryMissing(filePath);
				return false;
			}

			// although verifyTemplate checks for correct filename, check it here before doing an expensive copy-dir operation
			const remoteTemplateConfigFile = FileUtils.formPath([
				filePath,
				Config.TEMPLATE_CONFIG_FILE,
			]);
			if (!FileUtils.doesFileExist(remoteTemplateConfigFile)) {
				FileUtils.deleteDirectory(snapshotDir);
				io.errorTemplateFileMissing(remoteTemplateConfigFile, false);
				return false;
			}

			const dirName = FileUtils.getPathAndFileName(filePath).filename;
			FileUtils.copyDirectory(filePath, snapshotDir);
			localDir = FileUtils.formPath([snapshotDir, dirName]);
			templateRootDir = dirName;

			if (!FileUtils.doesDirectoryExist(localDir)) {
				io.errorGeneric("saveTemplate::2");
				return false;
			}

			template = await verifyTemplate(localDir, true);

			templateSource = {
				sourceType: "dir" as TemplateSourceType,
			};
			break;
	}

	if (!template) {
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
		io.errorGeneric("saveTemplate::3");
		return false;
	}

	const info: SnapshotRecord = {
		key: key,
		description: description,
		type: SnapshotType.Template,
		tags: tagList,
		structure: structure,
		parameters: parameters ?? undefined,
		templateRootDir: templateRootDir,
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
// --------------------------------------------------------

export async function createTemplateFromDirectory(
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

/* 
	this function is called directly as a command (from CLI) 
	and also from other template management functions for template verification 
*/
export async function verifyTemplate(
	templateDirPath: string,
	suppressSuccessMsg?: boolean,
	pathToConfigFile?: boolean, // if true then 'templateDirPath' is path to the config file itself
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

export async function updateTemplate(
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

export async function generateProjectFromTemplate(
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

	const templateFile = FileUtils.formPath([
		snapshotDir,
		record.templateRootDir,
		Config.TEMPLATE_CONFIG_FILE,
	]);

	if (!FileUtils.doesFileExist(templateFile)) {
		io.errorCorruptedData("template-config-file");
		return false;
	}

	const template = await TemplateUtils.readTemplateFile(templateFile);
	if (!template) {
		io.errorReadingTemplateConfigFile(key, templateFile);
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

	if (record.parameters && record.parameters.length > 0) {
		if (jsonParams) {
			const jsonData = JSON.parse(jsonParams);
			const missingItems = [];

			for (let i = 0; i < record.parameters.length; ++i) {
				if (!Object.hasOwn(jsonData, record.parameters[i])) {
					missingItems.push(record.parameters[i]);
				} else {
					paramValues[record.parameters[i]] = jsonData[record.parameters[i]];
				}
			}

			if (missingItems.length > 0) {
				io.errorJSONMissingParameters(key, missingItems);
				return false;
			}
		} else {
			paramValues = await io.promptForTemplateParameters(
				record.parameters,
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
		_src_type: record.templateSource.sourceType,
	};

	if (record.templateSource.sourceType === "git") {
		templateAnswers._url = record.templateSource.url;
		templateAnswers._version = record.templateSource.version;
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

	for (let i = 0; i < record.structure!.length; ++i) {
		const node = record.structure![i];

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

	io.successTemplateProjectGenerated(
		key,
		toPath,
		template._post_generation_message,
	);
	return true;
}

// ---------------- [private] --------------------

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
