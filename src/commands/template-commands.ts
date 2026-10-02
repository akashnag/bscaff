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
import { TemplateParseError } from "../types/errors.js";
import { Template } from "../types/template-types.js";
import { SnapshotRecord, SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as ParamUtils from "../utils/param-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
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
	let gitRepoSource = undefined;

	if (source === "git") {
		// filePath is a Git URL
		let repoName = filePath.substring(1 + filePath.lastIndexOf("/")).trim();
		if (repoName.toLowerCase().endsWith(".git")) {
			repoName = repoName.substring(repoName.length - 4);
		}

		localDir = FileUtils.formPath([snapshotDir, repoName]);

		FileUtils.createDirectory(localDir);

		const git: SimpleGit = simpleGit.simpleGit();
		const gitIO = new SaveGitRepoIO();

		try {
			gitIO.cloneStart(localDir);

			// fetch latest tag
			gitRepoSource = {
				url: filePath,
				version: await getLatestRemoteTag(git, filePath),
			};

			// clone the latest tag if exists
			if (gitRepoSource.version) {
				await git.clone(filePath, localDir, [
					"--branch",
					gitRepoSource.version,
					"--single-branch",
				]);
			} else {
				await git.clone(filePath, localDir);
			}

			gitIO.cloneComplete();

			const templateConfigFile = FileUtils.formPath([
				localDir,
				Config.TEMPLATE_CONFIG_FILE,
			]);

			if (!FileUtils.doesFileExist(templateConfigFile)) {
				io.errorTemplateFileMissing(filePath, true);
				FileUtils.deleteDirectory(snapshotDir);
				return false;
			}
		} catch {
			gitIO.cloneFailed();
			FileUtils.deleteDirectory(snapshotDir);
			return false;
		}
	} else if (source === "zip") {
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

		const zipRootDir = TemplateUtils.getZipRootDirectory(filePath);
		if (!zipRootDir) {
			FileUtils.deleteDirectory(snapshotDir);
			io.invalidTemplateZipFile(filePath);
			return false;
		}

		if (
			!TemplateUtils.doesZipHaveFileUnderRootDirectory(
				filePath,
				Config.TEMPLATE_CONFIG_FILE,
				zipRootDir,
			)
		) {
			io.errorTemplateFileMissing(filePath, false);
			FileUtils.deleteDirectory(snapshotDir);
			return false;
		}

		if (!TemplateUtils.extractZipFile(filePath, snapshotDir)) {
			io.errorExtractingZip(filePath);
			return false;
		}

		if (
			!FileUtils.doesFileExist(
				FileUtils.formPath([
					snapshotDir,
					zipRootDir,
					Config.TEMPLATE_CONFIG_FILE,
				]),
			)
		) {
			FileUtils.deleteDirectory(snapshotDir);
			io.errorExtractingZip(filePath);
			return false;
		}

		localDir = FileUtils.formPath([snapshotDir, zipRootDir]);
	} else if (!source || source == "dir") {
		filePath = FileUtils.resolvePath(filePath);

		if (!FileUtils.doesDirectoryExist(filePath)) {
			FileUtils.deleteDirectory(snapshotDir);
			io.errorSourceDirectoryMissing(filePath);
			return false;
		}

		const remoteTemplateConfigFile = FileUtils.formPath([
			filePath,
			Config.TEMPLATE_CONFIG_FILE,
		]);
		if (!FileUtils.doesFileExist(remoteTemplateConfigFile)) {
			FileUtils.deleteDirectory(snapshotDir);
			io.errorTemplateFileMissing(remoteTemplateConfigFile, false);
			return false;
		}

		const dirName = FileUtils.getContainingDirectoryOfFile(filePath);
		FileUtils.copyDirectory(filePath, snapshotDir);
		localDir = FileUtils.formPath([snapshotDir, dirName]);
	} else {
		// handled by Commander
		return false;
	}

	const template = await TemplateUtils.readTemplateFile(
		FileUtils.formPath([localDir, Config.TEMPLATE_CONFIG_FILE]),
	);

	if (!template) {
		io.errorInvalidTemplateFormat(filePath);
		return false;
	}

	const relativeTemplateFilePath = FileUtils.formRelativePath(
		snapshotDir,
		FileUtils.formPath([localDir, Config.TEMPLATE_CONFIG_FILE]),
	);
	const tagList = tags ? tags.split(",") : undefined;

	const templateConfigFilePath = FileUtils.formPath([
		localDir,
		Config.TEMPLATE_CONFIG_FILE,
	]);

	const templateDir = template._subdirectory
		? FileUtils.formPath([localDir, template._subdirectory])
		: localDir;

	const { structure, parameters, stats } =
		await TreeUtils.extractStructureFromDirectory(templateDir);

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
		fileName: FileUtils.getRelativePath(templateConfigFilePath, snapshotDir),
		structure: structure,
		parameters: parameters ?? undefined,
	};

	if (source === "git") {
		info.gitRepoSource = gitRepoSource;
	}

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

// called from extract-commands::extract()
export async function extractTemplate(
	key: string,
	record: SnapshotRecord,
	dryRun: boolean | undefined,
	overwriteBehaviour: string | undefined,
	toPath: string,
): Promise<boolean> {
	if (record.type !== SnapshotType.Template) return false;
	if (!overwriteBehaviour) overwriteBehaviour = "prompt";

	const io = new ExtractTemplateIO();

	const templateFile = SnapshotUtils.getFileUnderSnapshot(
		key,
		record.fileName!,
	);

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

	const templateDir = FileUtils.getPathAndFileName(templateFile).path;
	const templateDirName = FileUtils.getPathAndFileName(templateDir).filename;
	const templateSourceDir = template._subdirectory
		? FileUtils.formPath([templateDir, template._subdirectory])
		: templateDir;

	const engine = ParamUtils.createTemplateEngine(template._envops);
	const templateOptions = {
		exclude: template._exclude ?? undefined,
		include: template._include ?? undefined,
		templatesSuffix: template._templates_suffix ?? undefined,
	};

	const paramValues = io.promptForTemplateParameters(
		record.parameters!,
		TemplateUtils.getCustomKeysFromTemplate(template),
		template,
	);

	const targetRoot = FileUtils.formPath([
		toPath,
		ParamUtils.replacePlaceholdersInFileName(
			templateDirName,
			paramValues,
			templateOptions,
			engine,
		),
	]);

	if (!FileUtils.doesDirectoryExist(targetRoot)) {
		io.infoCreateDirectory(targetRoot);
		if (!dryRun) FileUtils.createDirectory(targetRoot);
	}

	if (!dryRun) {
		if (
			!(await executeTemplateTriggerTasks(
				"Pre",
				template._pre_generation_tasks,
				targetRoot,
				paramValues,
				engine,
				io,
			))
		) {
			io.errorTemplateExtractionFailed("PRE_GENERATION_TASKS_FAILED");
			return false;
		}
	}

	const excludedDirs: string[] = [];

	for (let i = 0; i < record.structure!.length; ++i) {
		const node = record.structure![i];

		const nodePath = ParamUtils.replacePlaceholdersInFileName(
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

		const sourcePath = FileUtils.formPath([templateSourceDir, nodePath]);
		const targetPath = FileUtils.formPath([targetRoot, nodePath]);

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
			if (!dryRun) FileUtils.copyFile(sourcePath, targetPath);
		}
	}

	if (!dryRun) {
		if (
			await executeTemplateTriggerTasks(
				"Post",
				template._post_generation_tasks,
				targetRoot,
				paramValues,
				engine,
				io,
			)
		) {
			io.successTemplateExtracted(key);
			return true;
		} else {
			io.errorTemplateExtractionFailed("POST_GENERATION_TASKS_FAILED");
			return false;
		}
	} else {
		io.successTemplateExtracted(key);
		return true;
	}
}

export async function createTemplateFromDirectory(
	key: string | undefined,
	desc: string | undefined,
	tags: string | undefined,
	fromPath: string,
): Promise<boolean> {
	const io = new SaveTemplateIO();

	if (!key) {
		io.errorMissingParameter("key");
		return false;
	}

	fromPath = FileUtils.resolvePath(fromPath);
	if (FileUtils.doesDirectoryExist(fromPath)) {
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

	const randFile = MiscUtils.createRandomFile(
		"yml",
		templateContent,
		true,
		false,
	);

	if (!randFile) {
		io.errorCreatingTempFile();
		return false;
	}

	if (!verifyTemplate(randFile, template)) {
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
	const { structure, parameters, stats } =
		await TreeUtils.extractStructureFromDirectory(templateDir, false);

	const tagList = tags ? tags.split(",") : undefined;
	const info: SnapshotRecord = {
		key: key,
		description: desc,
		type: SnapshotType.Template,
		tags: tagList,
		fileName: FileUtils.getRelativePath(templateConfigFilePath, snapshotDir),
		structure: structure ?? undefined,
		parameters: parameters ?? undefined,
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

export async function verifyTemplate(
	filePath: string,
	targetTemplate?: Template,
): Promise<boolean> {
	const io = new VerifyTemplateIO();

	try {
		const modTemplate = await TemplateUtils.readTemplateFile(filePath);
		if (!modTemplate) {
			io.errorParsingTemplateFileContent();
			return false;
		}

		if (modTemplate._subdirectory) {
			const subDirPath = FileUtils.formPath([
				FileUtils.getPathAndFileName(filePath).path,
				modTemplate._subdirectory,
			]);

			if (!FileUtils.doesDirectoryExist(subDirPath)) {
				io.warnTemplateSubdirectoryDoesNotExist(subDirPath);
			}
		}

		if (targetTemplate) {
			Object.assign(targetTemplate, modTemplate);
		} else {
			io.successTemplateVerified();
		}
		return true;
	} catch (err: any) {
		io.errorDuringTemplateParsing(err as TemplateParseError);
		return false;
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

	if (!record.gitRepoSource || !record.gitRepoSource.url) {
		io.errorCannotUpdateNonGitTemplate(key);
		return false;
	}

	const git: SimpleGit = simpleGit.simpleGit();
	const gitIO = new SaveGitRepoIO();

	gitIO.startFetchGitTag(record.gitRepoSource.url);
	const remoteVersion = await getLatestRemoteTag(git, record.gitRepoSource.url);

	if (!remoteVersion) {
		gitIO.errorFetchingGitTag(record.gitRepoSource.url);
		return false;
	}

	gitIO.doneFetchingGitTag();

	if (
		record.gitRepoSource.version &&
		remoteVersion === record.gitRepoSource.version
	) {
		io.successTemplateGitRepoAlreadyLatest(
			key,
			record.gitRepoSource.url,
			record.gitRepoSource.version,
		);
		return true;
	}

	store.delete(key);

	const retVal = await saveTemplate(
		record.key,
		record.description,
		record.tags ? record.tags.join(",") : undefined,
		"git",
		record.gitRepoSource!.url,
	);

	if (retVal) {
		store.updateCreationTime(key, record.createdAt!);
		store.update();

		io.successTemplateUpdated(key);
		return true;
	}

	return false;
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
