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

import * as fs from "fs/promises";
import { minimatch } from "minimatch";
import path from "path";
import { Config } from "../core/config.js";
import { YAMLParseError } from "../types/errors.js";
import {
	Template,
	TemplateAnswers,
	TemplateAnswerValue,
	TemplateQuestion,
} from "../types/template-types.js";
import { FileTreeNode } from "../types/types.js";
import * as FileUtils from "./file-utils.js";
import * as MiscUtils from "./misc-utils.js";
import * as ParamUtils from "./param-utils.js";
import * as SpecialFileIOUtils from "./special-file-io.js";
import {
	drawFileTree,
	extractStructureFromASCIITree,
	extractStructureFromDirectory,
} from "./tree-utils.js";

export function writeTemplate(
	template: Template,
	filePath?: string,
): string | boolean {
	const content = SpecialFileIOUtils.stringifyYaml(template);
	if (filePath) {
		return FileUtils.writeTextFile(filePath, content);
	}
	return content;
}

export async function readTemplateFile(
	filePath: string,
): Promise<Template | null> {
	const rawDoc = await SpecialFileIOUtils.readYamlFile<unknown>(filePath);
	if (!rawDoc) return null;

	if (typeof rawDoc !== "object" || rawDoc === null) {
		throw new YAMLParseError(
			`Invalid template file structure in ${filePath}. Root must be an object.`,
		);
	}

	return normalizeAndValidateTemplate(rawDoc as Record<string, unknown>);
}

export function writeTemplateAnswers(
	template: TemplateAnswers,
	filePath?: string,
): string | boolean {
	const content = JSON.stringify(template, null, 2);
	if (filePath) {
		return FileUtils.writeTextFile(filePath, content);
	}
	return content;
}

export async function readTemplateAnswersFile(
	filePath: string,
): Promise<TemplateAnswers | null> {
	const rawDoc = await JSON.parse(
		(await FileUtils.readTextFile(filePath)) ?? "{}",
	);
	if (!rawDoc) return null;

	if (typeof rawDoc !== "object" || rawDoc === null) {
		throw new Error(`Invalid template answers file structure in ${filePath}.`);
	}

	return normalizeAndValidateTemplateAnswers(rawDoc as Record<string, unknown>);
}

export function getCustomKeysFromTemplate(template: Template): string[] {
	return Object.keys(template).filter((key) => !key.startsWith("_"));
}

export function normalizeAndValidateTemplateAnswers(
	raw: Record<string, unknown>,
): TemplateAnswers {
	const answers: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(raw)) {
		if (key.startsWith("_")) {
			// Preserve top-level metadata fields (_src_type, _url, _version, etc.)
			answers[key] = value;
		} else {
			// Validate and assign template answer values
			answers[key] = normalizeTemplateAnswerValue(value);
		}
	}

	// Basic runtime validation for required metadata
	if (!answers._src_type || typeof answers._src_type !== "string") {
		throw new Error(
			"Invalid or missing required field '_src_type' in TemplateAnswers.",
		);
	}

	return answers as TemplateAnswers;
}

export async function copyAndRenderTemplate(
	sourceDir: string,
	outputDir: string,
	answers: TemplateAnswers,
	templateConfig: Template,
): Promise<void> {
	const resolvedSourceDir = FileUtils.resolvePath(sourceDir);
	const resolvedOutputDir = FileUtils.resolvePath(outputDir);

	if (!FileUtils.doesDirectoryExist(resolvedSourceDir)) {
		throw new Error(
			`Template source directory does not exist: ${resolvedSourceDir}`,
		);
	}

	FileUtils.ensureDirectoryExists(resolvedOutputDir);

	const templatesSuffix = templateConfig._templates_suffix || ".jinja";
	const exclude = templateConfig._exclude || [];
	const include = templateConfig._include || [];
	const skipIfExistsFiles = templateConfig._skip_if_exists || [];

	// Options object matching your helper signatures
	const options = { exclude, include, templatesSuffix };

	// Initialize template engine with custom environment options if provided
	const engine = ParamUtils.createTemplateEngine(templateConfig._envops);

	// Recursive directory walk using your exclusion and path-replacement helpers
	async function walkAndRender(currentDir: string): Promise<void> {
		const entries = FileUtils.readDirectoryContentsWithTypes(currentDir);

		for (const entry of entries) {
			if (entry.name === ".git" || entry.name === ".bscaff.json") {
				continue;
			}

			const fullPath = FileUtils.formPath([currentDir, entry.name]);
			const relativeSourcePath = FileUtils.getRelativePath(
				fullPath,
				resolvedSourceDir,
			);

			// 1. Check exclusion rules using your existing helper
			if (
				ParamUtils.shouldFileOrDirectoryBeExcluded(relativeSourcePath, options)
			) {
				continue;
			}

			if (entry.isDirectory()) {
				// Fix 1: Render the full relative directory path so nested placeholders resolve correctly
				const relativeSourceDirPath = FileUtils.getRelativePath(
					fullPath,
					resolvedSourceDir,
				);
				const renderedDirPath = ParamUtils.replacePlaceholdersInFilePath(
					relativeSourceDirPath,
					answers,
					options,
					engine,
				);

				const targetSubDir = path.join(resolvedOutputDir, renderedDirPath);

				FileUtils.ensureDirectoryExists(targetSubDir);
				await walkAndRender(fullPath);
			} else if (entry.isFile()) {
				// 2. Transform file path using your placeholder & suffix-stripping helper
				const relativeTargetFile = ParamUtils.replacePlaceholdersInFilePath(
					relativeSourcePath,
					answers,
					options,
					engine,
				);

				const targetFilePath = path.join(resolvedOutputDir, relativeTargetFile);

				// Fix 2: Support glob patterns, directory patterns, and dotfiles using minimatch
				const shouldSkip = skipIfExistsFiles.some((pattern) => {
					return minimatch(relativeTargetFile, pattern, { dot: true });
				});

				if (shouldSkip && FileUtils.doesFileExist(targetFilePath)) {
					console.log(
						`Skipping existing file due to _skip_if_exists: ${relativeTargetFile}`,
					);
					continue;
				}

				FileUtils.ensureDirectoryExists(path.dirname(targetFilePath));

				// 4. Process content via your modified file content helper for text files, or copy binary
				const isText = await FileUtils.isTextFile(fullPath);

				if (isText) {
					const processedContent =
						await ParamUtils.getModifiedFileContentPostPlaceholderReplacement(
							fullPath,
							answers,
							options,
							engine,
						);

					if (processedContent !== null) {
						FileUtils.writeTextFile(targetFilePath, processedContent);
					} else {
						FileUtils.copyFile(fullPath, targetFilePath);
					}
				} else {
					FileUtils.copyFile(fullPath, targetFilePath);
				}
			}
		}
	}

	await walkAndRender(resolvedSourceDir);
}

// ------------------------- [private] -----------------------------

function normalizeAndValidateTemplate(raw: Record<string, unknown>): Template {
	const template: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(raw)) {
		if (key.startsWith("_")) {
			(template as Record<string, unknown>)[key] = value;
		} else {
			// Normalize shorthand prompt definitions
			if (
				typeof value === "object" &&
				value !== null &&
				!Array.isArray(value)
			) {
				template[key] = value as TemplateQuestion;
			} else {
				// Expand shorthand string/boolean/number defaults into Question objects
				template[key] = {
					default: value as TemplateQuestion["default"],
					type:
						typeof value === "number"
							? "int"
							: typeof value === "boolean"
								? "bool"
								: "str",
				};
			}
		}
	}

	return template as Template;
}

function normalizeTemplateAnswerValue(value: unknown): TemplateAnswerValue {
	if (value === null || value === undefined) {
		return null;
	}

	const type = typeof value;

	if (type === "string" || type === "number" || type === "boolean") {
		return value as TemplateAnswerValue;
	}

	if (Array.isArray(value)) {
		return value.map((item) => normalizeTemplateAnswerValue(item));
	}

	if (type === "object") {
		const normalizedObj: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
			normalizedObj[k] = normalizeTemplateAnswerValue(v);
		}
		return normalizedObj;
	}

	// Fallback for unsupported types (e.g. functions, symbols)
	return String(value);
}
