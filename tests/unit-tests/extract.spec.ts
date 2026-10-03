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
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type FileTreeNode, SnapshotType } from "../src/types/types.js";
import {
	cleanupTestDir,
	createFileTree,
	createSampleTemplateFixture,
	createTestDir,
	dirExists,
	executeCLI,
	fileExists,
	readFile,
	readFileTree,
	seedSnapshot,
	TEST_DIR,
} from "./helpers/index.js";

describe("extract command", () => {
	beforeEach(async () => {
		await createTestDir();
	});

	afterEach(async () => {
		await cleanupTestDir();
	});

	// =========================================================================
	// 1. Files Snapshot Extraction
	// =========================================================================
	describe("Files snapshot extraction", () => {
		it("extracts all files under snapshot to destination directory", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(
				homeDir,
				{
					key: "files-basic",
					type: SnapshotType.Files,
				},
				{
					"app.config.json": '{"mode": "production"}\n',
					"docs/README.md": "# Documentation\n",
				},
			);

			const targetDir = path.join(TEST_DIR, "files-out");
			const result = await executeCLI(
				["-k", "files-basic", "extract", targetDir, "-e", "overwrite"],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);

			const extracted = await readFileTree(targetDir);
			expect(extracted["app.config.json"]).toBe('{"mode": "production"}\n');
			expect(extracted["docs/README.md"]).toBe("# Documentation\n");
		});

		it("respects --dry-run without creating files on disk", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(
				homeDir,
				{
					key: "files-dry",
					type: SnapshotType.Files,
				},
				{
					"data.txt": "dry run payload",
				},
			);

			const targetDir = path.join(TEST_DIR, "files-dry-out");
			const result = await executeCLI(
				["-k", "files-dry", "extract", targetDir, "--dry-run"],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await fileExists(path.join(targetDir, "data.txt"))).toBe(false);
		});

		it("extracts a single file when --partial is provided", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(
				homeDir,
				{
					key: "files-partial",
					type: SnapshotType.Files,
				},
				{
					"keep.txt": "wanted",
					"ignore.txt": "unwanted",
				},
			);

			const targetDir = path.join(TEST_DIR, "files-partial-out");
			const result = await executeCLI(
				[
					"-k",
					"files-partial",
					"extract",
					targetDir,
					"--partial",
					"keep.txt",
					"-e",
					"overwrite",
				],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await fileExists(path.join(targetDir, "keep.txt"))).toBe(true);
			expect(await fileExists(path.join(targetDir, "ignore.txt"))).toBe(false);
		});

		it("fails extraction with -e fail if destination file already exists", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(
				homeDir,
				{
					key: "files-collision-fail",
					type: SnapshotType.Files,
				},
				{
					"config.json": '{"new": true}',
				},
			);

			const targetDir = path.join(TEST_DIR, "files-fail-dest");
			await createFileTree(targetDir, {
				"config.json": '{"original": true}',
			});

			const result = await executeCLI(
				["-k", "files-collision-fail", "extract", targetDir, "-e", "fail"],
				TEST_DIR,
			);

			expect(result.exitCode).not.toBe(0);
			expect(await readFile(path.join(targetDir, "config.json"))).toBe(
				'{"original": true}',
			);
		});

		it("skips existing files with -e skip and preserves original content", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(
				homeDir,
				{
					key: "files-collision-skip",
					type: SnapshotType.Files,
				},
				{
					"existing.txt": "new content",
					"fresh.txt": "fresh content",
				},
			);

			const targetDir = path.join(TEST_DIR, "files-skip-dest");
			await createFileTree(targetDir, {
				"existing.txt": "original content",
			});

			const result = await executeCLI(
				["-k", "files-collision-skip", "extract", targetDir, "-e", "skip"],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await readFile(path.join(targetDir, "existing.txt"))).toBe(
				"original content",
			);
			expect(await readFile(path.join(targetDir, "fresh.txt"))).toBe(
				"fresh content",
			);
		});

		it("overwrites existing files when -e overwrite is specified", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(
				homeDir,
				{
					key: "files-collision-overwrite",
					type: SnapshotType.Files,
				},
				{
					"config.json": '{"updated": true}',
				},
			);

			const targetDir = path.join(TEST_DIR, "files-overwrite-dest");
			await createFileTree(targetDir, {
				"config.json": '{"old": true}',
			});

			const result = await executeCLI(
				[
					"-k",
					"files-collision-overwrite",
					"extract",
					targetDir,
					"-e",
					"overwrite",
				],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await readFile(path.join(targetDir, "config.json"))).toBe(
				'{"updated": true}',
			);
		});
	});

	// =========================================================================
	// 2. Tree Snapshot Extraction
	// =========================================================================
	describe("Tree snapshot extraction", () => {
		it("extracts directory trees creating nested directories and files", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			const structure: FileTreeNode[] = [
				{ type: "dir", level: 0, name: "src", path: "src" },
				{ type: "dir", level: 1, name: "utils", path: "src/utils" },
				{
					type: "file",
					level: 2,
					name: "math.ts",
					path: "src/utils/math.ts",
				},
				{ type: "file", level: 0, name: "README.md", path: "README.md" },
			];

			await seedSnapshot(
				homeDir,
				{
					key: "tree-nested",
					type: SnapshotType.Tree,
					structure,
				},
				{
					"src/utils/math.ts": "export const sum = (a, b) => a + b;\n",
					"README.md": "# Tree Root\n",
				},
			);

			const targetDir = path.join(TEST_DIR, "tree-out");
			const result = await executeCLI(
				["-k", "tree-nested", "extract", targetDir, "-e", "overwrite"],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await dirExists(path.join(targetDir, "src/utils"))).toBe(true);
			expect(
				await readFile(path.join(targetDir, "src/utils/math.ts")),
			).toContain("export const sum");
			expect(await readFile(path.join(targetDir, "README.md"))).toBe(
				"# Tree Root\n",
			);
		});

		it("respects --dry-run without creating directories or files", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			const structure: FileTreeNode[] = [
				{ type: "dir", level: 0, name: "pkg", path: "pkg" },
				{ type: "file", level: 1, name: "main.go", path: "pkg/main.go" },
			];

			await seedSnapshot(
				homeDir,
				{
					key: "tree-dry",
					type: SnapshotType.Tree,
					structure,
				},
				{
					"pkg/main.go": "package main\n",
				},
			);

			const targetDir = path.join(TEST_DIR, "tree-dry-out");
			const result = await executeCLI(
				["-k", "tree-dry", "extract", targetDir, "--dry-run"],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await dirExists(path.join(targetDir, "pkg"))).toBe(false);
			expect(await fileExists(path.join(targetDir, "pkg/main.go"))).toBe(false);
		});

		it("extracts only a subtree when --partial specifies a subpath", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			const structure: FileTreeNode[] = [
				{ type: "dir", level: 0, name: "backend", path: "backend" },
				{
					type: "file",
					level: 1,
					name: "server.ts",
					path: "backend/server.ts",
				},
				{ type: "dir", level: 0, name: "frontend", path: "frontend" },
				{ type: "file", level: 1, name: "app.tsx", path: "frontend/app.tsx" },
			];

			await seedSnapshot(
				homeDir,
				{
					key: "tree-partial",
					type: SnapshotType.Tree,
					structure,
				},
				{
					"backend/server.ts": "server code\n",
					"frontend/app.tsx": "ui code\n",
				},
			);

			const targetDir = path.join(TEST_DIR, "tree-partial-out");
			const result = await executeCLI(
				[
					"-k",
					"tree-partial",
					"extract",
					targetDir,
					"--partial",
					"backend",
					"-e",
					"overwrite",
				],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await fileExists(path.join(targetDir, "server.ts"))).toBe(true);
			expect(await fileExists(path.join(targetDir, "app.tsx"))).toBe(false);
		});

		it("fails extraction with -e fail when destination file in tree exists", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			const structure: FileTreeNode[] = [
				{ type: "file", level: 0, name: "lock.txt", path: "lock.txt" },
			];

			await seedSnapshot(
				homeDir,
				{
					key: "tree-fail-collision",
					type: SnapshotType.Tree,
					structure,
				},
				{
					"lock.txt": "new lock\n",
				},
			);

			const targetDir = path.join(TEST_DIR, "tree-fail-dest");
			await createFileTree(targetDir, {
				"lock.txt": "existing lock\n",
			});

			const result = await executeCLI(
				["-k", "tree-fail-collision", "extract", targetDir, "-e", "fail"],
				TEST_DIR,
			);

			expect(result.exitCode).not.toBe(0);
			expect(await readFile(path.join(targetDir, "lock.txt"))).toBe(
				"existing lock\n",
			);
		});

		it("skips existing files with -e skip during tree extraction", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			const structure: FileTreeNode[] = [
				{ type: "file", level: 0, name: "base.txt", path: "base.txt" },
			];

			await seedSnapshot(
				homeDir,
				{
					key: "tree-skip-collision",
					type: SnapshotType.Tree,
					structure,
				},
				{
					"base.txt": "new base\n",
				},
			);

			const targetDir = path.join(TEST_DIR, "tree-skip-dest");
			await createFileTree(targetDir, {
				"base.txt": "original base\n",
			});

			const result = await executeCLI(
				["-k", "tree-skip-collision", "extract", targetDir, "-e", "skip"],
				TEST_DIR,
			);

			expect(result.exitCode).toBe(0);
			expect(await readFile(path.join(targetDir, "base.txt"))).toBe(
				"original base\n",
			);
		});
	});

	// =========================================================================
	// 3. Template Snapshot Extraction
	// =========================================================================
	describe("Template snapshot extraction", () => {
		it("extracts a saved template into the target root directory", async () => {
			const templateDir = path.join(TEST_DIR, "tmpl-source");
			await createSampleTemplateFixture(templateDir, {
				minVersion: "0.0.1",
				extraFiles: {
					"config.yaml": "app: demo\n",
				},
			});

			const saveResult = await executeCLI(
				[
					"-k",
					"my-template",
					"template",
					"save",
					templateDir,
					"--source",
					"dir",
				],
				TEST_DIR,
			);
			expect(saveResult.exitCode).toBe(0);

			const targetDir = path.join(TEST_DIR, "tmpl-target");
			const extractResult = await executeCLI(
				["-k", "my-template", "extract", targetDir, "-e", "overwrite"],
				TEST_DIR,
			);

			expect(extractResult.exitCode).toBe(0);

			// Template files are rendered under the template root directory
			const files = await readFileTree(targetDir);
			const filePaths = Object.keys(files);
			expect(filePaths.some((p) => p.includes("README.md"))).toBe(true);
			expect(filePaths.some((p) => p.includes("package.json"))).toBe(true);
		});

		it("respects template _exclude patterns during extraction", async () => {
			const templateDir = path.join(TEST_DIR, "tmpl-exclude-src");
			await createSampleTemplateFixture(templateDir, {
				exclude: ["*.secret", "ignore_dir/**"],
				extraFiles: {
					"app.secret": "SHOULD_BE_EXCLUDED",
					"ignore_dir/file.txt": "SHOULD_BE_EXCLUDED",
					"public.txt": "SHOULD_BE_INCLUDED",
				},
			});

			const saveResult = await executeCLI(
				[
					"-k",
					"tmpl-exclude",
					"template",
					"save",
					templateDir,
					"--source",
					"dir",
				],
				TEST_DIR,
			);
			expect(saveResult.exitCode).toBe(0);

			const targetDir = path.join(TEST_DIR, "tmpl-exclude-out");
			const extractResult = await executeCLI(
				["-k", "tmpl-exclude", "extract", targetDir, "-e", "overwrite"],
				TEST_DIR,
			);

			expect(extractResult.exitCode).toBe(0);

			const files = await readFileTree(targetDir);
			const filePaths = Object.keys(files);
			expect(filePaths.some((p) => p.includes("public.txt"))).toBe(true);
			expect(filePaths.some((p) => p.includes("app.secret"))).toBe(false);
			expect(filePaths.some((p) => p.includes("ignore_dir"))).toBe(false);
		});

		it("allows dry-run for templates when no trigger tasks exist", async () => {
			const templateDir = path.join(TEST_DIR, "tmpl-notriggers-src");
			await createSampleTemplateFixture(templateDir);

			const saveResult = await executeCLI(
				[
					"-k",
					"tmpl-notriggers",
					"template",
					"save",
					templateDir,
					"--source",
					"dir",
				],
				TEST_DIR,
			);
			expect(saveResult.exitCode).toBe(0);

			const targetDir = path.join(TEST_DIR, "tmpl-dry-target");
			const extractResult = await executeCLI(
				["-k", "tmpl-notriggers", "extract", targetDir, "--dry-run"],
				TEST_DIR,
			);

			expect(extractResult.exitCode).toBe(0);
			const exists = await dirExists(targetDir);
			if (exists) {
				const files = await readFileTree(targetDir);
				expect(Object.keys(files).length).toBe(0);
			}
		});

		it("fails dry-run when template defines pre- or post-generation tasks", async () => {
			const templateDir = path.join(TEST_DIR, "tmpl-tasks-src");
			await createSampleTemplateFixture(templateDir, {
				preGenerationTasks: ["echo 'pre'"],
			});

			const saveResult = await executeCLI(
				[
					"-k",
					"tmpl-tasks",
					"template",
					"save",
					templateDir,
					"--source",
					"dir",
				],
				TEST_DIR,
			);
			expect(saveResult.exitCode).toBe(0);

			const targetDir = path.join(TEST_DIR, "tmpl-tasks-dry-fail");
			const extractResult = await executeCLI(
				["-k", "tmpl-tasks", "extract", targetDir, "--dry-run"],
				TEST_DIR,
			);

			// Expected to fail with errorCannotDryRunInPresenceOfTriggers
			expect(extractResult.exitCode).not.toBe(0);
		});

		it("fails template extraction when -e fail is specified and target file exists", async () => {
			const templateDir = path.join(TEST_DIR, "tmpl-fail-src");
			await createSampleTemplateFixture(templateDir);

			await executeCLI(
				[
					"-k",
					"tmpl-fail",
					"template",
					"save",
					templateDir,
					"--source",
					"dir",
				],
				TEST_DIR,
			);

			const targetDir = path.join(TEST_DIR, "tmpl-fail-target");
			// Pre-create target root with an existing file to trigger collision
			await createFileTree(path.join(targetDir, "tmpl-fail-src"), {
				"README.md": "original content",
			});

			const extractResult = await executeCLI(
				["-k", "tmpl-fail", "extract", targetDir, "-e", "fail"],
				TEST_DIR,
			);

			expect(extractResult.exitCode).not.toBe(0);
		});
	});

	// =========================================================================
	// 4. Unsupported Snapshot Types (URL and Snippet)
	// =========================================================================
	describe("Unsupported snapshot types", () => {
		it("fails extraction when snapshot is of type URL", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(homeDir, {
				key: "url-snapshot",
				type: SnapshotType.URL,
				urlContent: "https://example.com/docs",
			});

			const targetDir = path.join(TEST_DIR, "url-extract-out");
			const result = await executeCLI(
				["-k", "url-snapshot", "extract", targetDir],
				TEST_DIR,
			);

			// Extraction is unsupported for URL snapshots
			expect(result.exitCode).not.toBe(0);
		});

		it("fails extraction when snapshot is of type Snippet", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(
				homeDir,
				{
					key: "snippet-snapshot",
					type: SnapshotType.Snippet,
					fileName: "snippet.ts",
				},
				{
					"snippet.ts": "export const x = 42;\n",
				},
			);

			const targetDir = path.join(TEST_DIR, "snippet-extract-out");
			const result = await executeCLI(
				["-k", "snippet-snapshot", "extract", targetDir],
				TEST_DIR,
			);

			// Extraction is unsupported for Snippet snapshots
			expect(result.exitCode).not.toBe(0);
		});
	});

	// =========================================================================
	// 5. Validation and Error Handling
	// =========================================================================
	describe("Validation and error handling", () => {
		it("fails when key option (-k) is missing", async () => {
			const targetDir = path.join(TEST_DIR, "no-key-out");
			const result = await executeCLI(["extract", targetDir], TEST_DIR);

			expect(result.exitCode).not.toBe(0);
		});

		it("fails when snapshot key does not exist in store", async () => {
			const targetDir = path.join(TEST_DIR, "not-found-out");
			const result = await executeCLI(
				["-k", "non-existent-key", "extract", targetDir],
				TEST_DIR,
			);

			expect(result.exitCode).not.toBe(0);
		});

		it("fails when snapshot record has corrupted/missing structure", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(homeDir, {
				key: "corrupt-structure",
				type: SnapshotType.Files,
				structure: undefined,
			});

			const targetDir = path.join(TEST_DIR, "corrupt-out");
			const result = await executeCLI(
				["-k", "corrupt-structure", "extract", targetDir],
				TEST_DIR,
			);

			expect(result.exitCode).not.toBe(0);
		});

		it("fails when snapshot record has corrupted/missing parameters", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(homeDir, {
				key: "corrupt-params",
				type: SnapshotType.Files,
				structure: [{ type: "file", level: 0, name: "a.txt", path: "a.txt" }],
				parameters: undefined,
			});

			const targetDir = path.join(TEST_DIR, "corrupt-params-out");
			const result = await executeCLI(
				["-k", "corrupt-params", "extract", targetDir],
				TEST_DIR,
			);

			expect(result.exitCode).not.toBe(0);
		});

		it("fails when template config file is missing on disk", async () => {
			const homeDir = path.join(TEST_DIR, ".home");
			await seedSnapshot(homeDir, {
				key: "missing-tmpl-config",
				type: SnapshotType.Template,
				fileName: "missing-template.yml",
			});

			const targetDir = path.join(TEST_DIR, "missing-tmpl-out");
			const result = await executeCLI(
				["-k", "missing-tmpl-config", "extract", targetDir],
				TEST_DIR,
			);

			expect(result.exitCode).not.toBe(0);
		});
	});
});
