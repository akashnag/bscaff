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
import { Store } from "../core/store.js";
import { SaveGitRepoIO } from "../io/save.js";
import { SaveTemplateIO } from "../io/template.js";
import { SnapshotType } from "../types/types.js";
import { Config } from "../utils/config.js";
import * as FileUtils from "../utils/files.js";
import * as MiscUtils from "../utils/misc.js";
import * as SnapshotUtils from "../utils/snapshot.js";
import * as TemplateUtils from "../utils/template.js";
import * as TreeUtils from "../utils/tree.js";

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
			await git.clone(filePath, localDir);
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

	store.save({
		key: key,
		description: description,
		type: SnapshotType.Template,
		tags: tagList,
		fileName: relativeTemplateFilePath,
		structure: structure,
		parameters: parameters ?? undefined,
	});

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
