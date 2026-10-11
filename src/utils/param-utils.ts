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

import * as nunjucks from "nunjucks";
import { Settings } from "../core/settings.js";
import { Template, TemplateEnvOps } from "../types/template-types.js";
import * as FileUtils from "./file-utils.js";

export function createTemplateEngine(
	envops?: TemplateEnvOps,
): nunjucks.Environment {
	const env = new nunjucks.Environment(null, { autoescape: false });

	if (envops) {
		// Configure custom delimiters in Nunjucks
		(env as unknown as { opts: { tags: Record<string, string> } }).opts.tags = {
			blockStart: envops.block_start_string || "{%",
			blockEnd: envops.block_end_string || "%}",
			variableStart: envops.variable_start_string || "{{",
			variableEnd: envops.variable_end_string || "}}",
			commentStart: envops.comment_start_string || "{#",
			commentEnd: envops.comment_end_string || "#}",
		};
	}

	return env;
}

export function getParametersFromText(
	text: string,
	engine?: nunjucks.Environment,
): string[] {
	if (!text) return [];
	if (!engine) engine = createTemplateEngine();

	const variables = new Set<string>();

	// 1. Retrieve custom delimiters safely from the engine options
	const tags = (engine as any).opts?.tags || {
		variableStart: "{{",
		variableEnd: "}}",
	};

	// Helper to escape special regex characters in custom tags
	const escapeRegExp = (str: string) =>
		str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

	const varStart = escapeRegExp(tags.variableStart);
	const varEnd = escapeRegExp(tags.variableEnd);

	// 2. Build a dynamic regex matching your template engine's variable tags.
	// This matches names and dot-notation (e.g., {{ user.name }})
	const regex = new RegExp(`${varStart}\\s*([a-zA-Z0-9_.]+)\\s*${varEnd}`, "g");

	let match;
	while ((match = regex.exec(text)) !== null) {
		if (match[1]) {
			const fullPath = match[1].trim();

			// If you want the root object of dot notation (e.g., "db" from "db.host"),
			// you can split by dot. Otherwise, keep `fullPath` if you want the whole expression.
			const rootVariable = fullPath.split(".")[0];

			variables.add(rootVariable);
		}
	}

	return Array.from(variables);
}

export async function getParametersFromFileContent(
	filePath: string,
	options: { exclude?: string[]; include?: string[]; templatesSuffix?: string },
	engine?: nunjucks.Environment,
): Promise<string[]> {
	// Check template suffix (if suffix is non-empty, file must end with it)
	if (options.templatesSuffix && !filePath.endsWith(options.templatesSuffix)) {
		return [];
	}

	// Helper to test if filePath matches any pattern in a list
	const matchesAny = (patterns: string[]): boolean =>
		patterns.some((pattern) => globToRegex(pattern).test(filePath));

	// Evaluate inclusions vs exclusions:
	// Inclusions override exclusions. If included, process it.
	// If explicitly excluded (and not included), skip it.
	const isIncluded =
		options.include &&
		options.include.length > 0 &&
		matchesAny(options.include);

	const isExcluded =
		options.exclude &&
		options.exclude.length > 0 &&
		matchesAny(options.exclude);

	if (isExcluded && !isIncluded) {
		return [];
	}

	// Read and extract parameters
	const content = await FileUtils.readTextFile(filePath);
	return content ? getParametersFromText(content, engine) : [];
}

export function shouldFileOrDirectoryBeExcluded(
	fPath: string,
	options: { exclude?: string[]; include?: string[] },
): boolean {
	const matchesAny = (patterns: string[]): boolean =>
		patterns.some((pattern) => globToRegex(pattern).test(fPath));

	const hasInclude = Boolean(options.include && options.include.length > 0);
	const hasExclude = Boolean(options.exclude && options.exclude.length > 0);

	const isIncluded = hasInclude ? matchesAny(options.include!) : false;
	const isExcluded = hasExclude ? matchesAny(options.exclude!) : false;

	// If explicit includes exist, file must NOT be included to be excluded.
	// If an exclude pattern matches, exclude it unless explicit includes take precedence.
	if (hasInclude) {
		return isExcluded || !isIncluded;
	}

	return isExcluded;
}

export function replacePlaceholdersInFilePath(
	filePath: string,
	paramValues: Record<string, any>,
	options: { exclude?: string[]; include?: string[]; templatesSuffix?: string },
	engine?: nunjucks.Environment,
): string {
	const matchesAny = (patterns: string[]): boolean =>
		patterns.some((pattern) => globToRegex(pattern).test(filePath));

	const isIncluded =
		options.include &&
		options.include.length > 0 &&
		matchesAny(options.include);

	const isExcluded =
		options.exclude &&
		options.exclude.length > 0 &&
		matchesAny(options.exclude);

	if (isExcluded && !isIncluded) {
		return filePath;
	}

	let modFileName = replacePlaceholdersInText(filePath, paramValues, engine);

	if (
		options.templatesSuffix &&
		modFileName.endsWith(options.templatesSuffix)
	) {
		modFileName = modFileName.substring(
			0,
			modFileName.length - options.templatesSuffix.length,
		);
	}
	return modFileName;
}

export async function getModifiedFileContentPostPlaceholderReplacement(
	filePath: string,
	paramValues: Record<string, any>,
	options: { exclude?: string[]; include?: string[]; templatesSuffix: string },
	engine?: nunjucks.Environment,
): Promise<string | null> {
	const matchesAny = (patterns: string[]): boolean =>
		patterns.some((pattern) => globToRegex(pattern).test(filePath));

	const content = await FileUtils.readTextFile(filePath);
	if (!content) return null;

	const isIncluded =
		options.include &&
		options.include.length > 0 &&
		matchesAny(options.include);

	const isExcluded =
		options.exclude &&
		options.exclude.length > 0 &&
		matchesAny(options.exclude);

	if (isExcluded && !isIncluded) {
		return content;
	}

	if (options.templatesSuffix && !filePath.endsWith(options.templatesSuffix)) {
		return content;
	}

	return replacePlaceholdersInText(content, paramValues, engine);
}

// ----------------------- [private] ---------------------------

function globToRegex(glob: string, flags: string = "i"): RegExp {
	let regexStr = "";
	let i = 0;
	const len = glob.length;

	while (i < len) {
		const char = glob[i];

		if (char === "*") {
			if (glob[i + 1] === "*") {
				// Handle `**` (matches across directories)
				if (glob[i + 2] === "/") {
					regexStr += "(?:.*/|)";
					i += 3;
				} else {
					regexStr += ".*";
					i += 2;
				}
			} else {
				// Single `*` (matches anything except directory separators)
				regexStr += "[^/]*";
				i++;
			}
		} else if (char === "?") {
			// `?` matches any single character except directory separators
			regexStr += "[^/]";
			i++;
		} else if (["/", "\\"].includes(char)) {
			// Normalize path separators
			regexStr += "[/\\\\]";
			i++;
		} else if ("[].+^${}()|/\\".includes(char)) {
			// Escape special regex characters
			regexStr += "\\" + char;
			i++;
		} else {
			regexStr += char;
			i++;
		}
	}

	return new RegExp(`^${regexStr}$`, flags);
}

function replacePlaceholdersInText(
	text: string,
	paramValues: Record<string, any>,
	engine?: nunjucks.Environment,
): string {
	if (!engine) engine = createTemplateEngine();
	return engine.renderString(text, paramValues);
}
