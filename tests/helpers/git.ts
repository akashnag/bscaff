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

import * as path from "node:path";
import simpleGit, { type SimpleGit } from "simple-git";
import { createFileTree, type FileTreeDefinition } from "./fs.js";

/**
 * Initializes a local Git repository with test user configuration and an initial commit.
 *
 * This enables offline testing of git-based commands:
 * - `bscaff save tree <url> --git`
 * - `bscaff template save <url> --source git`
 * - `bscaff template update`
 *
 * @param repoDir - Directory to initialize as a Git repository
 * @param initialFiles - Optional dictionary of files to create and commit
 * @returns SimpleGit client instance
 */
export async function initLocalGitRepo(
	repoDir: string,
	initialFiles?: FileTreeDefinition,
): Promise<SimpleGit> {
	const git: SimpleGit = simpleGit(repoDir);

	await git.init();
	await git.addConfig("user.name", "Test User");
	await git.addConfig("user.email", "test@example.com");
	await git.addConfig("commit.gpgsign", "false");

	if (initialFiles && Object.keys(initialFiles).length > 0) {
		await createFileTree(repoDir, initialFiles);
		await git.add(".");
		await git.commit("Initial commit");
	}

	return git;
}

/**
 * Commits a set of files to an existing Git repository.
 *
 * @param repoDir - Directory of the Git repository
 * @param files - Files to create or update
 * @param message - Commit message
 */
export async function commitToGitRepo(
	repoDir: string,
	files: FileTreeDefinition,
	message = "Update files",
): Promise<void> {
	const git: SimpleGit = simpleGit(repoDir);
	await createFileTree(repoDir, files);
	await git.add(".");
	await git.commit(message);
}

/**
 * Creates a Git tag in a repository (e.g. "v1.0.0").
 * Useful for testing version-tagged template cloning and updates.
 *
 * @param repoDir - Directory of the Git repository
 * @param tag - Tag name
 */
export async function createGitTag(
	repoDir: string,
	tag: string,
): Promise<void> {
	const git: SimpleGit = simpleGit(repoDir);
	await git.addTag(tag);
}

/**
 * Sets up a local bare Git repository that acts as a remote upstream origin.
 *
 * @param bareDir - Directory where bare repository should be created
 * @param sourceRepoDir - Existing repository to clone from or push to
 * @returns Local file URL or path string that can be passed to `git clone`
 */
export async function createBareGitRemote(
	bareDir: string,
	sourceRepoDir: string,
): Promise<string> {
	const bareGit: SimpleGit = simpleGit(bareDir);
	await bareGit.init(true);

	const sourceGit: SimpleGit = simpleGit(sourceRepoDir);
	await sourceGit.addRemote("origin", bareDir);
	await sourceGit.push("origin", "HEAD");

	return bareDir;
}
