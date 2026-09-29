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
	templateContent: string,
	engine?: nunjucks.Environment,
): string[] {
	const variables = new Set<string>();
	const nodes = (nunjucks as any).nodes;

	if (!engine) engine = createTemplateEngine();

	try {
		// 1. Create a Parser instance bound to your custom Environment's lexer
		// This ensures custom envops (tags/delimiters) are respected during tokenization!
		const parser = new (nunjucks as any).parser.Parser(
			(nunjucks as any).lexer.lex(templateContent, (engine as any).opts?.tags),
		);

		// 2. Parse into AST
		const ast = parser.parse();

		// 3. Walk AST to collect variable symbols
		function walkNodes(node: any): void {
			if (!node) return;

			// 'Symbol' nodes represent variable identifiers
			if (node instanceof nodes.Symbol) {
				variables.add(node.value);
			}

			// 'LookupVal' nodes represent property accesses (e.g. [[ db.host ]])
			if (node instanceof nodes.LookupVal) {
				let root = node.target;
				while (root && root.target) {
					root = root.target;
				}
				if (root && root instanceof nodes.Symbol) {
					variables.add(root.value);
				}
			}

			// Traverse child properties
			for (const key in node) {
				if (Object.prototype.hasOwnProperty.call(node, key)) {
					const child = (node as Record<string, any>)[key];
					if (child && typeof child === "object") {
						if (Array.isArray(child)) {
							child.forEach((c) => walkNodes(c));
						} else if (child instanceof nodes.Node) {
							walkNodes(child);
						}
					}
				}
			}
		}

		walkNodes(ast);
	} catch (err) {
		console.warn("Failed to parse template AST for variable extraction:", err);
	}

	return Array.from(variables);
}

export async function getParametersFromFileContent(
	filePath: string,
	template?: Template,
	engine?: nunjucks.Environment,
): Promise<string[]> {
	// Check template suffix (if suffix is non-empty, file must end with it)
	if (
		template &&
		template._templates_suffix &&
		!filePath.endsWith(template._templates_suffix)
	) {
		return [];
	}

	// Helper to test if filePath matches any pattern in a list
	const matchesAny = (patterns: string[]): boolean =>
		patterns.some((pattern) => globToRegex(pattern).test(filePath));

	// Evaluate inclusions vs exclusions:
	// Inclusions override exclusions. If included, process it.
	// If explicitly excluded (and not included), skip it.
	const isIncluded =
		template &&
		template._include &&
		template._include.length > 0 &&
		matchesAny(template._include);

	const isExcluded =
		template &&
		template._exclude &&
		template._exclude.length > 0 &&
		matchesAny(template._exclude);

	if (isExcluded && !isIncluded) {
		return [];
	}

	// Read and extract parameters
	const content = await FileUtils.readTextFile(filePath);
	return content ? getParametersFromText(content, engine) : [];
}

export function replacePlaceholdersInText(
	template: string,
	paramValues: Record<string, unknown>,
	engine?: nunjucks.Environment,
): string {
	if (!engine) engine = createTemplateEngine();
	return engine.renderString(template, paramValues);
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
