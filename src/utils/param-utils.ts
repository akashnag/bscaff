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
import { TemplateEnvOps } from "../types/template-types.js";
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

export async function getParametersFromFileContent(
	filePath: string,
): Promise<string[]> {
	const fileType = FileUtils.getFileType(filePath, true);
	const exclusions = Settings.get("excludeFromContentModification")?.split(";");

	if (exclusions) {
		for (let i = 0; i < exclusions.length; ++i) {
			if (
				exclusions[i].substring(1).toLocaleLowerCase() ==
				fileType.toLocaleLowerCase()
			)
				return [];
		}
	}

	const content = await FileUtils.readTextFile(filePath);
	if (!content) return [];

	return getParametersFromText(content);
}

export function replacePlaceholdersInText(
	template: string,
	params: Record<string, string>,
): string {
	return template.replace(/\{\{\s*(.*?)\s*\}\}/g, (match, key) => {
		return key in params ? params[key] : match;
	});
}

// Extracts all parameters enclosed within {{ and }} from a string
export function getParametersFromText(text: string): string[] {
	// Regex matching {{ followed by non-}} characters, capturing the inner content
	const regex = /\{\{([^}]+)\}\}/g;
	const matches: string[] = [];

	let match: RegExpExecArray | null;
	while ((match = regex.exec(text)) !== null) {
		// match[1] refers to the first capture group (inside {{ }})
		matches.push(match[1].trim());
	}

	return matches;
}

/**
 * Extracts all variable names from a template string using the environment's custom delimiters.
 */
export function extractTemplateVariables(
	templateContent: string,
	engine: nunjucks.Environment,
): string[] {
	const variables = new Set<string>();
	const nodes = (nunjucks as any).nodes;

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
