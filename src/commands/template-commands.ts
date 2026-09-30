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

import simpleGit, { SimpleGit } from "simple-git";
import { Config } from "../core/config.js";
import { Store } from "../core/store.js";
import { SaveGitRepoIO } from "../io/save-io.js";
import { SaveTemplateIO } from "../io/template-io.js";
import { SnapshotRecord, SnapshotType } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import * as SnapshotUtils from "../utils/snapshot-utils.js";
import * as TemplateUtils from "../utils/template-utils.js";
import * as TreeUtils from "../utils/tree-utils.js";

// --------------------------------------------------------
// template save <zip-OR-repo-URL> [--git]
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

	const template = TemplateUtils.readTemplateFile(
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
	const { structure, parameters, stats } =
		await TreeUtils.extractStructureFromDirectory(localDir);

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
		fileName: relativeTemplateFilePath,
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
	key: string | undefined,
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

export async function createTemplateFromDirectory(
	key: string | undefined,
	desc: string | undefined,
	tags: string | undefined,
	fromPath: string,
): Promise<boolean> {
	// TODO: add code
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
	const remoteVersion = await getLatestRemoteTag(git, record.gitRepoSource.url);

	if (!remoteVersion) {
		gitIO.errorFetchingGitRepo(record.gitRepoSource.url);
		return false;
	}

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

// -------------------------- [private] ------------------------
