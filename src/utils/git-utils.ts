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

import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { SimpleGit } from "simple-git";
import { Config } from "../core/config.js";
import { Settings } from "../core/settings.js";
import { ExtractTemplateIO } from "../io/template-io.js";
import { Template, TemplateAnswers } from "../types/template-types.js";
import * as FileUtils from "./file-utils.js";
import { createTempDirectory } from "./misc-utils.js";
import * as ParamUtils from "./param-utils.js";
import * as TemplateUtils from "./template-utils.js";
import * as TreeUtils from "./tree-utils.js";

export async function getLatestRemoteGitCommitHash(
	git: SimpleGit,
	repoURL: string,
): Promise<string | undefined> {
	// Query HEAD for the specified repository URL
	const rawOutput = await git.listRemote([repoURL, "HEAD"]);

	const line = rawOutput
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.endsWith("HEAD"));

	if (!line) return undefined;

	// Extract the commit hash (the first column before whitespace)
	return line.split(/\s+/)[0];
}

// ---------------------- [unused] ----------------------------

/*
interface MergeOptions {
	repoUrl: string;
	targetDir: string;
	remoteBranch?: string; // defaults to 'origin/HEAD'
}

function runGitInScratch(scratchPad: string, args: string[]): string {
	return execFileSync("git", args, { cwd: scratchPad, encoding: "utf-8" });
}

export async function mergeRemoteChanges({
	repoUrl,
	targetDir,
	remoteBranch = "origin/HEAD",
}: MergeOptions): Promise<boolean> {
	const io = new ExtractTemplateIO();
	const resolvedTargetDir = path.resolve(targetDir);

	if (!FileUtils.doesDirectoryExist(resolvedTargetDir)) {
		throw new Error(`Target directory does not exist: ${resolvedTargetDir}`);
	}

	// 1. Locate and read project answers file at the root of the target project directory
	const answersFilePath = path.join(
		resolvedTargetDir,
		Config.TEMPLATE_PROJECT_CONFIG_FILE,
	);

	let answers: TemplateAnswers | null = null;
	if (FileUtils.doesFileExist(answersFilePath)) {
		try {
			answers = await TemplateUtils.readTemplateAnswersFile(answersFilePath);
		} catch (error) {
			throw new Error(
				`Failed to read or parse project answers file at ${answersFilePath}: ${error}`,
			);
		}
	}

	if (!answers || !answers._version) {
		throw new Error(
			`Can not update since original git repo version/tag is missing in the answers file.`,
		);
	}

	const oldCommitHash = answers._version;

	// 2. Create scratchpad and clone the repo
	const scratchPad = createTempDirectory();
	const tempBaseRenderDir = createTempDirectory();
	const tempRemoteRenderDir = createTempDirectory();
	const tempStagingDir = createTempDirectory();
	const tempBackupDir = createTempDirectory();

	if (
		!scratchPad ||
		!tempBaseRenderDir ||
		!tempRemoteRenderDir ||
		!tempStagingDir ||
		!tempBackupDir
	) {
		await cleanupTempFiles([
			scratchPad,
			tempBaseRenderDir,
			tempRemoteRenderDir,
			tempStagingDir,
			tempBackupDir,
		]);
		throw new Error("Error creating temporary working directories");
	}

	try {
		execFileSync("git", ["clone", repoUrl, scratchPad], { stdio: "inherit" });
		runGitInScratch(scratchPad, ["fetch", "origin"]);
	} catch (error) {
		await cleanupTempFiles([
			scratchPad,
			tempBaseRenderDir,
			tempRemoteRenderDir,
			tempStagingDir,
			tempBackupDir,
		]);
		throw new Error(`Failed to clone repository from ${repoUrl}: ${error}`);
	}

	// Resolve remote branch reference
	let resolvedRemote = remoteBranch;
	if (resolvedRemote === "origin/HEAD") {
		try {
			resolvedRemote = runGitInScratch(scratchPad, [
				"symbolic-ref",
				"refs/remotes/origin/HEAD",
			]).trim();
		} catch {
			resolvedRemote = "origin/main";
		}
	}

	let baseTemplateConfig: Template;
	let remoteTemplateConfig: Template | null;

	try {
		console.log(
			`Rendering base template version (${oldCommitHash}) into temp directory...`,
		);
		baseTemplateConfig = await renderTemplateAtRef(
			oldCommitHash,
			tempBaseRenderDir,
			scratchPad,
			answers,
		);

		// Checkout remote to read and validate its config before rendering
		runGitInScratch(scratchPad, ["checkout", resolvedRemote]);
		const remoteConfigPath = path.join(scratchPad, Config.TEMPLATE_CONFIG_FILE);
		remoteTemplateConfig =
			await TemplateUtils.readTemplateFile(remoteConfigPath);

		if (!remoteTemplateConfig) {
			throw new Error(`Could not parse remote template config`);
		}

		// 2. Abort if template configs (_envops, etc.) have changed between versions
		if (
			JSON.stringify(baseTemplateConfig) !==
			JSON.stringify(remoteTemplateConfig)
		) {
			throw new Error(
				"Template configuration (e.g. _envops, excludes, etc.) has changed between versions. Aborting update.",
			);
		}

		// 1. Prompt user for any new template variables introduced in the remote version
		const subDirectory = remoteTemplateConfig._subdirectory
			? remoteTemplateConfig._subdirectory.replace(/^\/+|\/+$/g, "")
			: "";
		const sourceDir = subDirectory
			? path.join(scratchPad, subDirectory)
			: scratchPad;

		const templatingOptions = {
			exclude:
				remoteTemplateConfig._exclude ??
				Settings.get("exclude") ??
				Settings.DEFAULT_SETTINGS.exclude,
			include:
				remoteTemplateConfig._include ??
				Settings.get("include") ??
				Settings.DEFAULT_SETTINGS.include,
			templatesSuffix:
				remoteTemplateConfig._templates_suffix ??
				Settings.get("templatesSuffix") ??
				Settings.DEFAULT_SETTINGS.templatesSuffix,
		};

		const { parameters: identifiedParams } =
			await TreeUtils.extractStructureFromDirectory(
				sourceDir,
				templatingOptions,
				false,
				true,
			);

		if (!identifiedParams) {
			throw new Error(
				`Error extracting parameters from directory: ${sourceDir}`,
			);
		}

		const promptResult = await io.promptForTemplateParameters(
			identifiedParams,
			TemplateUtils.getCustomKeysFromTemplate(remoteTemplateConfig),
			remoteTemplateConfig,
		);

		promptResult._src_type = "git";
		answers = promptResult as TemplateAnswers;

		console.log(
			`Rendering remote template version (${resolvedRemote}) into temp directory...`,
		);
		await renderTemplateAtRef(
			resolvedRemote,
			tempRemoteRenderDir,
			scratchPad,
			answers,
		);
	} catch (error) {
		await cleanupTempFiles([
			scratchPad,
			tempBaseRenderDir,
			tempRemoteRenderDir,
			tempStagingDir,
			tempBackupDir,
		]);
		throw new Error(`Failed to render template trees for comparison: ${error}`);
	}

	// Resolve exact target commit SHA for answers file update
	let newCommitSha = oldCommitHash;
	try {
		newCommitSha = runGitInScratch(scratchPad, [
			"rev-parse",
			resolvedRemote,
		]).trim();
	} catch {
		// Fallback to ref string if rev-parse fails
		newCommitSha = resolvedRemote;
	}

	try {
		// 3. Gather all files across base, remote, and local target directories
		const baseFiles = await getFilesRecursive(tempBaseRenderDir);
		const remoteFiles = await getFilesRecursive(tempRemoteRenderDir);
		const localFiles = await getFilesRecursive(resolvedTargetDir);

		const allRelativeFiles = Array.from(
			new Set([...baseFiles, ...remoteFiles, ...localFiles]),
		).filter(
			(file) =>
				file !== Config.TEMPLATE_PROJECT_CONFIG_FILE &&
				!isGitInternalPath(file),
		);

		// 4. Perform 3-way merge file by file into staging directory
		for (const relativeFilePath of allRelativeFiles) {
			const basePath = path.join(tempBaseRenderDir, relativeFilePath);
			const remotePath = path.join(tempRemoteRenderDir, relativeFilePath);
			const localPath = path.join(resolvedTargetDir, relativeFilePath);
			const stagingPath = path.join(tempStagingDir, relativeFilePath);

			FileUtils.ensureDirectoryExists(path.dirname(stagingPath));

			const existsInBase = FileUtils.doesFileExist(basePath);
			const existsInRemote = FileUtils.doesFileExist(remotePath);
			const existsInLocal = FileUtils.doesFileExist(localPath);

			// Handle mutual deletion cleanly
			if (!existsInRemote && !existsInLocal) {
				continue;
			}

			// Determine text vs binary using any available version
			const samplePath = existsInLocal
				? localPath
				: existsInRemote
					? remotePath
					: basePath;
			const isText = await FileUtils.isTextFile(samplePath);

			if (!isText) {
				// --- BINARY FILE HANDLING ---
				const baseBuf = existsInBase
					? await fs.promises.readFile(basePath)
					: null;
				const remoteBuf = existsInRemote
					? await fs.promises.readFile(remotePath)
					: null;
				const localBuf = existsInLocal
					? await fs.promises.readFile(localPath)
					: null;

				const baseRemoteUnchanged =
					(baseBuf === null && remoteBuf === null) ||
					(baseBuf && remoteBuf && baseBuf.equals(remoteBuf));
				const baseLocalUnchanged =
					(baseBuf === null && localBuf === null) ||
					(baseBuf && localBuf && baseBuf.equals(localBuf));

				if (baseRemoteUnchanged) {
					if (existsInLocal) {
						FileUtils.copyFile(localPath, stagingPath);
					}
					continue;
				}

				if (baseLocalUnchanged) {
					if (existsInRemote) {
						FileUtils.copyFile(remotePath, stagingPath);
					}
					continue;
				}

				// Both modified binary file or created independently
				if (localBuf && remoteBuf && localBuf.equals(remoteBuf)) {
					FileUtils.copyFile(remotePath, stagingPath);
					continue;
				}

				if (!existsInBase) {
					throw new Error(
						`Binary merge conflict detected: file "${relativeFilePath}" was created independently with different contents in local and remote.`,
					);
				}

				throw new Error(
					`Binary merge conflict detected: both local and remote modified binary file "${relativeFilePath}".`,
				);
			}

			// --- TEXT FILE 3-WAY MERGE HANDLING ---
			const baseContent = existsInBase
				? await FileUtils.readTextFile(basePath)
				: null;
			const remoteContent = existsInRemote
				? await FileUtils.readTextFile(remotePath)
				: null;
			const localContent = existsInLocal
				? await FileUtils.readTextFile(localPath)
				: null;

			const baseRemoteUnchanged = baseContent === remoteContent;
			const baseLocalUnchanged = baseContent === localContent;

			if (baseRemoteUnchanged) {
				if (existsInLocal) {
					FileUtils.copyFile(localPath, stagingPath);
				}
				continue;
			}

			if (baseLocalUnchanged) {
				if (existsInRemote) {
					FileUtils.copyFile(remotePath, stagingPath);
				}
				continue;
			}

			// Both changed relative to base.
			if (!existsInBase) {
				// Created independently in both local and remote
				if (localContent === remoteContent) {
					FileUtils.copyFile(remotePath, stagingPath);
					continue;
				}
				throw new Error(
					`Merge conflict: file "${relativeFilePath}" was created independently with different contents in local and remote.`,
				);
			}

			if (!existsInRemote) {
				throw new Error(
					`Merge conflict: file "${relativeFilePath}" was deleted remotely but modified locally.`,
				);
			}

			if (!existsInLocal) {
				throw new Error(
					`Merge conflict: file "${relativeFilePath}" was modified remotely but deleted locally.`,
				);
			}

			// Write temporary files for git merge-file
			const tBase = path.join(
				scratchPad,
				`base_${Math.random().toString(36).substring(7)}`,
			);
			const tLocal = path.join(
				scratchPad,
				`local_${Math.random().toString(36).substring(7)}`,
			);
			const tRemote = path.join(
				scratchPad,
				`remote_${Math.random().toString(36).substring(7)}`,
			);

			FileUtils.writeTextFile(tBase, baseContent ?? "");
			FileUtils.writeTextFile(tLocal, localContent ?? "");
			FileUtils.writeTextFile(tRemote, remoteContent ?? "");

			try {
				const mergedOutput = execFileSync(
					"git",
					["merge-file", "-p", tLocal, tBase, tRemote],
					{
						encoding: "utf-8",
						stdio: ["pipe", "pipe", "pipe"],
					},
				);

				FileUtils.writeTextFile(stagingPath, mergedOutput);
			} catch {
				throw new Error(
					`Merge conflict detected in text file: "${relativeFilePath}". Aborting update to prevent conflict markers.`,
				);
			} finally {
				await cleanupTempFiles([tBase, tLocal, tRemote]);
			}
		}

		// 5. Update answers file version with new commit SHA
		answers._version = newCommitSha;
		const stagedAnswersPath = path.join(
			tempStagingDir,
			Config.TEMPLATE_PROJECT_CONFIG_FILE,
		);
		FileUtils.ensureDirectoryExists(path.dirname(stagedAnswersPath));
		TemplateUtils.writeTemplateAnswers(answers, stagedAnswersPath);

		// 6. Atomic-safe Application with Rollback Journal
		await applyStagingWithRollback(
			tempStagingDir,
			tempBaseRenderDir,
			resolvedTargetDir,
			tempBackupDir,
		);

		return true;
	} finally {
		await cleanupTempFiles([
			scratchPad,
			tempBaseRenderDir,
			tempRemoteRenderDir,
			tempStagingDir,
			tempBackupDir,
		]);
	}
}

// Rollback journal mechanism to guarantee atomicity across filesystems
async function applyStagingWithRollback(
	stagingDir: string,
	baseRenderDir: string,
	targetDir: string,
	backupDir: string,
): Promise<void> {
	const stagedFiles = await getFilesRecursive(stagingDir);
	const baseFiles = await getFilesRecursive(baseRenderDir);
	const localFiles = await getFilesRecursive(targetDir);

	// Union of all files affected by staging or base template scope
	const allFilesToInspect = Array.from(
		new Set([...stagedFiles, ...baseFiles, ...localFiles]),
	);

	const backedUpFiles: string[] = [];

	try {
		// Step A: Backup existing files in target that will be modified or removed
		for (const file of allFilesToInspect) {
			const targetPath = path.join(targetDir, file);
			if (FileUtils.doesFileExist(targetPath)) {
				const backupPath = path.join(backupDir, file);
				FileUtils.ensureDirectoryExists(path.dirname(backupPath));
				await fs.promises.copyFile(targetPath, backupPath);
				backedUpFiles.push(file);
			}
		}

		// Step B: Apply changes from staging (overwrite or create)
		for (const file of stagedFiles) {
			const srcPath = path.join(stagingDir, file);
			const destPath = path.join(targetDir, file);
			FileUtils.ensureDirectoryExists(path.dirname(destPath));
			await fs.promises.copyFile(srcPath, destPath);
		}

		// Step C: Remove files that existed in base render tree but are absent in staging (handled deletions)
		for (const file of baseFiles) {
			if (!stagedFiles.includes(file)) {
				const destPath = path.join(targetDir, file);
				if (FileUtils.doesFileExist(destPath)) {
					await fs.promises.rm(destPath, { force: true });
				}
			}
		}
	} catch (error) {
		// Rollback: Restore all backed up files from journal
		console.error("Error applying updates. Rolling back changes...", error);
		for (const file of backedUpFiles) {
			const backupPath = path.join(backupDir, file);
			const targetPath = path.join(targetDir, file);
			if (FileUtils.doesFileExist(backupPath)) {
				FileUtils.ensureDirectoryExists(path.dirname(targetPath));
				await fs.promises.copyFile(backupPath, targetPath);
			}
		}
		throw new Error(
			`Failed to apply template updates safely and rolled back: ${error}`,
		);
	}
}

function isGitInternalPath(filePath: string): boolean {
	const segments = filePath.split(path.sep);
	return segments.includes(".git") || segments[0] === ".git";
}

async function renderTemplateAtRef(
	ref: string,
	outputDir: string,
	scratchPad: string,
	answers: TemplateAnswers,
): Promise<Template> {
	runGitInScratch(scratchPad, ["checkout", ref]);

	const templateConfigFilePath = path.join(
		scratchPad,
		Config.TEMPLATE_CONFIG_FILE,
	);

	if (!FileUtils.doesFileExist(templateConfigFilePath)) {
		throw new Error(`Template config file not found at ref: ${ref}`);
	}

	const templateConfig = await TemplateUtils.readTemplateFile(
		templateConfigFilePath,
	);

	if (!templateConfig) {
		throw new Error(`Could not parse template config`);
	}

	const subDirectory = templateConfig._subdirectory
		? templateConfig._subdirectory.replace(/^\/+|\/+$/g, "")
		: "";

	const sourceDir = subDirectory
		? path.join(scratchPad, subDirectory)
		: scratchPad;

	await TemplateUtils.copyAndRenderTemplate(
		sourceDir,
		outputDir,
		answers,
		templateConfig,
	);

	return templateConfig;
}

async function cleanupTempFiles(paths: any[]): Promise<void> {
	for (const p of paths) {
		if (p && FileUtils.doesFileExist(p)) {
			try {
				await fs.promises.rm(p, { recursive: true, force: true });
			} catch {
				// Ignore cleanup race conditions
			}
		}
	}
}

async function getFilesRecursive(
	dir: string,
	baseDir: string = dir,
): Promise<string[]> {
	if (!FileUtils.doesDirectoryExist(dir)) return [];
	const entries = FileUtils.readDirectoryContentsWithTypes(dir);
	const files: string[] = [];

	for (const entry of entries) {
		if (
			entry.name === ".git" ||
			entry.name === Config.TEMPLATE_PROJECT_CONFIG_FILE
		)
			continue;

		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			const subFiles = await getFilesRecursive(fullPath, baseDir);
			files.push(...subFiles);
		} else {
			files.push(path.relative(baseDir, fullPath));
		}
	}

	return files;
}

export async function getLatestRemoteGitTag(
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
*/
