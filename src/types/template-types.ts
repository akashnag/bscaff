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

export type TemplateQuestionType =
	| "str"
	| "int"
	| "float"
	| "bool"
	| "json"
	| "yaml";

export interface TemplateQuestion {
	type?: TemplateQuestionType;
	prompt?: string;
	default?:
		| string
		| number
		| boolean
		| Record<string, unknown>
		| Array<unknown>;
	choices?:
		| Array<string | number | boolean>
		| Record<string, string | number | boolean>;
	when?: boolean | string;
	validator?: string;
	validator_error?: string;
	secret?: boolean;
	multiline?: boolean;
	placeholder?: string;
}

export interface TemplateMigrationTask {
	version: string;
	command: string | string[];
}

export interface TemplateEnvOps {
	block_start_string?: string;
	block_end_string?: string;
	variable_start_string?: string;
	variable_end_string?: string;
	comment_start_string?: string; // {#
	comment_end_string?: string; // #}
	autoescape?: boolean;
	[key: string]: unknown;
}

export interface Template {
	_min_bscaff_version: string;

	// source template from specific sub-directory instead of root
	_subdirectory?: string;

	// message to display after project generation is done
	_post_generation_message?: string;

	// Glob patterns to exclude completely from template processing
	_exclude?: string[];

	// Glob patterns to explicitly include even if matched by _exclude
	_include?: string[];

	// Files to generate during initial setup, but never overwrite during updates
	_skip_if_exists?: string[];

	// Suffix used to identify template files (default: ".jinja")
	_templates_suffix?: string;

	/*
	// Template engine subtype
	_subtype?: string;

	// Custom Jinja/Nunjucks template extensions or filters to load
	_jinja_extensions?: string[];
	*/

	// Custom Jinja environment parser/delimiter configuration
	_envops?: TemplateEnvOps;

	// Pre and Post-generation/update lifecycle shell commands
	_pre_generation_tasks?: string[];
	_post_generation_tasks?: string[];

	// Migration tasks executed sequentially during template version updates
	_migrations?: TemplateMigrationTask[];

	// Top-level prompts/variables or additional metadata keys. Any key not starting with `_` is treated as a user prompt definition or plain default variable.
	[key: string]: unknown | TemplateQuestion;
}

export type TemplateSourceType = "git" | "dir" | "zip";

export interface TemplateAnswers {
	_src_type: TemplateSourceType;

	// The source path, URL, or repository reference from which the template was applied.
	_url?: string;

	// The specific git commit hash, tag, or version string of the template applied.
	_version?: string;

	[key: string]: unknown | TemplateAnswerValue;
}

export type TemplateAnswerValue =
	| string
	| number
	| boolean
	| Record<string, unknown>
	| Array<unknown>
	| null;
