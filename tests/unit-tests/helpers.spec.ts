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
import { SnapshotType } from "../src/types/types.js";
import {
	createFileTree,
	createMockClipboard,
	createSampleTemplateFixture,
	createTemplateZip,
	createTestWorkspace,
	fileExists,
	initLocalGitRepo,
	listFileTree,
	readFile,
	readFileTree,
	readTestDB,
	SAMPLE_ASCII_TREES,
	seedSnapshot,
	stripAnsi,
	type TestWorkspace,
} from "./helpers/index.js";

describe("Test Helpers Suite", () => {
	let ws: TestWorkspace;

	beforeEach(async () => {
		ws = await createTestWorkspace("bscaff-helper-test-");
	});

	afterEach(async () => {
		await ws.cleanup();
	});

	it("creates an isolated workspace with expected directories", async () => {
		expect(ws.root).toBeDefined();
		expect(ws.homeDir).toBe(path.join(ws.root, "home"));
		expect(ws.cwd).toBe(path.join(ws.root, "work"));
		expect(ws.targetDir).toBe(path.join(ws.root, "target"));
		expect(ws.templatesDir).toBe(path.join(ws.root, "templates"));
		expect(ws.storageDir).toBe(path.join(ws.homeDir, ".bscaff"));
	});

	it("creates and reads file trees accurately", async () => {
		const treeDefinition = {
			"README.md": "# Test Project",
			"src/index.ts": "export const message = 'hello';",
			"src/nested/util.ts":
				"export const add = (a: number, b: number) => a + b;",
			"empty/": null,
		};

		await createFileTree(ws.targetDir, treeDefinition);

		const files = await readFileTree(ws.targetDir);
		expect(files["README.md"]).toBe("# Test Project");
		expect(files["src/index.ts"]).toBe("export const message = 'hello';");
		expect(files["src/nested/util.ts"]).toBe(
			"export const add = (a: number, b: number) => a + b;",
		);

		const list = await listFileTree(ws.targetDir);
		expect(list).toEqual(["README.md", "src/index.ts", "src/nested/util.ts"]);
	});

	it("creates a sample template fixture", async () => {
		const fixture = await createSampleTemplateFixture(ws.templatesDir, {
			minVersion: "0.0.1",
			questions: {
				project_name: {
					type: "str",
					prompt: "Name?",
					default: "demo-project",
				},
			},
		});

		expect(await fileExists(fixture.configFile)).toBe(true);
		const configText = await readFile(fixture.configFile);
		expect(configText).toContain("demo-project");
		expect(configText).toContain("_min_bscaff_version: 0.0.1");

		const templateFiles = await listFileTree(ws.templatesDir);
		expect(templateFiles).toContain("bscaff-template.yml");
		expect(templateFiles).toContain("README.md.jinja");
		expect(templateFiles).toContain("package.json.jinja");
		expect(templateFiles).toContain("src/index.ts.jinja");
	});

	it("packages templates into zip files with root directory structure", async () => {
		await createSampleTemplateFixture(ws.templatesDir);
		const zipPath = path.join(ws.root, "template.zip");

		await createTemplateZip(ws.templatesDir, zipPath, "my-template-root");
		expect(await fileExists(zipPath)).toBe(true);
	});

	it("seeds snapshot records and files into test storage", async () => {
		await seedSnapshot(
			ws.homeDir,
			{
				key: "test-snapshot",
				type: SnapshotType.Files,
				description: "Pre-seeded test snapshot",
			},
			{
				"file1.txt": "File 1 content",
				"sub/file2.txt": "File 2 content",
			},
		);

		const db = await readTestDB(ws.homeDir);
		expect(db).toHaveLength(1);
		expect(db[0].key).toBe("test-snapshot");
		expect(db[0].type).toBe(SnapshotType.Files);

		const diskFile = path.join(
			ws.storageDir,
			"test-snapshot",
			"sub",
			"file2.txt",
		);
		expect(await fileExists(diskFile)).toBe(true);
		expect(await readFile(diskFile)).toBe("File 2 content");
	});

	it("mocks clipboard copy and paste operations", async () => {
		const mockClipboard = createMockClipboard("initial text");
		const restore = mockClipboard.install();

		expect(mockClipboard.getContent()).toBe("initial text");
		mockClipboard.setContent(SAMPLE_ASCII_TREES.BASIC);
		expect(mockClipboard.getContent()).toContain("my-app/");

		restore();
	});

	it("initializes local git repository with initial commit", async () => {
		const gitDir = path.join(ws.root, "git-repo");
		const git = await initLocalGitRepo(gitDir, {
			"README.md": "# Git Repo",
		});

		const status = await git.status();
		expect(status.isClean()).toBe(true);

		const log = await git.log();
		expect(log.total).toBe(1);
		expect(log.latest?.message).toBe("Initial commit");
	});

	it("strips ANSI color and control codes cleanly", () => {
		const coloredText = "\u001b[32m✔ Snapshot saved successfully\u001b[39m";
		expect(stripAnsi(coloredText)).toBe("✔ Snapshot saved successfully");
	});
});
