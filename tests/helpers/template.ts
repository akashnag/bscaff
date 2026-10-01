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
import AdmZip from "adm-zip";
import YAML from "yaml";
import { Config } from "../../src/core/config.js";
import type {
	Template,
	TemplateEnvOps,
	TemplateQuestion,
} from "../../src/types/template-types.js";
import { createFileTree, fileExists, readFile } from "./fs.js";

/**
 * Options for configuring a test template fixture.
 */
export interface SampleTemplateOptions {
	/** Minimum version of bscaff expected by the template */
	minVersion?: string;
	/** Subdirectory inside template where template files live */
	subdirectory?: string;
	/** Custom answers file name (defaults to bscaff-answers.yml) */
	answersFile?: string;
	/** Message displayed after copy */
	messageAfterCopy?: string;
	/** File patterns to exclude */
	exclude?: string[];
	/** File patterns to include */
	include?: string[];
	/** Files to generate on initial setup but not overwrite on update */
	skipIfExists?: string[];
	/** Template suffix (default: ".jinja") */
	templatesSuffix?: string;
	/** Custom Jinja / Nunjucks delimiters */
	envops?: TemplateEnvOps;
	/** Pre-generation shell tasks */
	preGenerationTasks?: string[];
	/** Post-generation shell tasks */
	postGenerationTasks?: string[];
	/** Interactive question definitions */
	questions?: Record<string, TemplateQuestion>;
	/** Additional custom files in the template */
	extraFiles?: Record<string, string>;
}

/**
 * Serializes a template configuration into YAML format for `bscaff-template.yml`.
 *
 * @param config - The template fields and questions
 * @returns YAML formatted string
 */
export function generateTemplateYaml(
	config: Partial<Template> & Record<string, any>,
): string {
	const templateDoc: Record<string, any> = {
		_min_bscaff_version: config._min_bscaff_version ?? "0.0.1",
		...config,
	};
	return YAML.stringify(templateDoc);
}

/**
 * Creates a ready-to-test template in the target directory.
 *
 * Generates:
 * - `bscaff-template.yml` containing standard questions (project_name, author, license, include_docker)
 * - Templated files with Jinja syntax (`{{ project_name }}/README.md.jinja`, `package.json.jinja`, etc.)
 * - Optional subdirectories, tasks, and exclusions
 *
 * @param targetDir - Directory where template files should be generated
 * @param options - Configuration overrides
 * @returns Object with paths to template directory and the config file
 */
export async function createSampleTemplateFixture(
	targetDir: string,
	options: SampleTemplateOptions = {},
): Promise<{ templateDir: string; configFile: string }> {
	const minVersion = options.minVersion ?? "0.0.1";
	const templatesSuffix = options.templatesSuffix ?? ".jinja";

	const questions: Record<string, TemplateQuestion> = options.questions ?? {
		project_name: {
			type: "str",
			prompt: "What is your project name?",
			default: "my-app",
		},
		author_name: {
			type: "str",
			prompt: "Who is the author?",
			default: "Akash Nag",
		},
		license: {
			type: "str",
			prompt: "Select license",
			choices: ["MIT", "Apache-2.0", "GPL-2.0"],
			default: "MIT",
		},
		include_docker: {
			type: "bool",
			prompt: "Include Dockerfile?",
			default: false,
		},
	};

	const yamlConfig: Record<string, any> = {
		_min_bscaff_version: minVersion,
		...(options.subdirectory ? { _subdirectory: options.subdirectory } : {}),
		...(options.answersFile ? { _answers_file: options.answersFile } : {}),
		...(options.messageAfterCopy
			? { _message_after_copy: options.messageAfterCopy }
			: {}),
		...(options.exclude ? { _exclude: options.exclude } : {}),
		...(options.include ? { _include: options.include } : {}),
		...(options.skipIfExists ? { _skip_if_exists: options.skipIfExists } : {}),
		...(options.templatesSuffix
			? { _templates_suffix: options.templatesSuffix }
			: {}),
		...(options.envops ? { _envops: options.envops } : {}),
		...(options.preGenerationTasks
			? { _pre_generation_tasks: options.preGenerationTasks }
			: {}),
		...(options.postGenerationTasks
			? { _post_generation_tasks: options.postGenerationTasks }
			: {}),
		...questions,
	};

	const configContent = generateTemplateYaml(yamlConfig);
	const configFile = path.join(targetDir, Config.TEMPLATE_CONFIG_FILE);

	// Base templates files
	const subDirPrefix = options.subdirectory ? `${options.subdirectory}/` : "";

	const templateFiles: Record<string, string | null> = {
		[Config.TEMPLATE_CONFIG_FILE]: configContent,
		[`${subDirPrefix}README.md${templatesSuffix}`]:
			"# {{ project_name }}\n\nCreated by {{ author_name }}.\n\nLicense: {{ license }}\n",
		[`${subDirPrefix}package.json${templatesSuffix}`]: JSON.stringify(
			{
				name: "{{ project_name }}",
				version: "1.0.0",
				author: "{{ author_name }}",
				license: "{{ license }}",
			},
			null,
			2,
		),
		[`${subDirPrefix}src/index.ts${templatesSuffix}`]:
			'export const APP_NAME = "{{ project_name }}";\nconsole.log(`Starting ${APP_NAME}...`);\n',
		[`${subDirPrefix}Dockerfile${templatesSuffix}`]:
			'{% if include_docker %}\nFROM node:20-alpine\nWORKDIR /app\nCOPY . .\nCMD ["npm", "start"]\n{% endif %}',
		...(options.extraFiles
			? Object.fromEntries(
					Object.entries(options.extraFiles).map(([k, v]) => [
						`${subDirPrefix}${k}`,
						v,
					]),
				)
			: {}),
	};

	await createFileTree(targetDir, templateFiles);

	return {
		templateDir: targetDir,
		configFile,
	};
}

/**
 * Compresses a directory into a .zip archive formatted for `bscaff template save ... --source zip`.
 *
 * bscaff requires zip files to have a single top-level root folder containing the template files
 * and `bscaff-template.yml`.
 *
 * @param sourceDir - Directory containing template files to zip
 * @param destZipPath - Output zip file path
 * @param rootDirName - Top-level root directory inside the zip (default: "template-root")
 * @returns The destination zip path
 */
export async function createTemplateZip(
	sourceDir: string,
	destZipPath: string,
	rootDirName = "template-root",
): Promise<string> {
	const zip = new AdmZip();
	zip.addLocalFolder(sourceDir, rootDirName);
	zip.writeZip(destZipPath);
	return destZipPath;
}

/**
 * Reads and parses the answers file (e.g. `bscaff-answers.yml`) generated during template extraction.
 *
 * @param targetDir - Target project directory where template was extracted
 * @param answersFileName - Name of answers file (defaults to "bscaff-answers.yml")
 * @returns Parsed answers object, or null if file does not exist
 */
export async function readAnswersFile(
	targetDir: string,
	answersFileName = "bscaff-answers.yml",
): Promise<Record<string, any> | null> {
	const filePath = path.join(targetDir, answersFileName);
	if (!(await fileExists(filePath))) {
		return null;
	}
	const content = await readFile(filePath);
	return YAML.parse(content);
}
