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

import * as inquirer from "@inquirer/prompts";
import { Config } from "../core/config.js";
import { TemplateParseError } from "../types/errors.js";
import { Template, TemplateQuestion } from "../types/template-types.js";
import {
	ConsoleIO,
	printField,
	printHeader,
	printIndented,
	QUIET_MODE,
} from "./io.js";

// --------------------------------------------------------
// template save <path>
// --------------------------------------------------------
export class SaveTemplateIO extends ConsoleIO {
	errorInvalidTemplateFormat(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("Invalid Template Format");
		printField("Error", `The template file format was invalid`);

		console.log("\nTo resolve:");
		printIndented(
			`Specify a valid bscaff template file (version <= ${Config.TEMPLATE_FILE_VERSION})`,
		);
	}

	errorTemplateFileMissing(repoPath: string, isGit: boolean): void {
		// TODO: add code
	}

	errorExpectedZipFile(filePath: string): void {
		// TODO: add code
	}

	errorExtractingZip(filePath: string): void {
		// TODO: add code
	}

	invalidTemplateZipFile(filePath: string): void {
		// TODO: add code
	}

	errorCannotUpdateNonGitTemplate(key: string): void {
		// TODO: add code
	}

	successTemplateUpdated(key: string): void {
		// TODO: add code
	}

	successTemplateGitRepoAlreadyLatest(
		key: string,
		url: string,
		version: string,
	): void {
		// TODO: add code
	}

	errorCreatingTemplateDueToInvalidTemplateFormat(): void {
		// TODO: add code
	}
}
// --------------------------------------------------------

// --------------------------------------------------------
// template verify <path>
// --------------------------------------------------------
export class VerifyTemplateIO extends ConsoleIO {
	errorParsingTemplateFileContent(): void {
		// TODO: add code
	}

	successTemplateVerified(): void {
		// TODO: add code
	}

	errorDuringTemplateParsing(err: TemplateParseError): void {
		// TODO: add code
	}

	warnTemplateSubdirectoryDoesNotExist(dirPath: string): void {
		// TODO: add code
	}
}

export class ExtractTemplateIO extends ConsoleIO {
	private _evaluateWhenCondition(
		condition: string,
		context: Record<string, any>,
	): boolean {
		try {
			const keys = Object.keys(context);
			const values = Object.values(context);
			// Safely evaluate simple conditions in context scope
			const func = new Function(...keys, `return Boolean(${condition});`);
			return func(...values);
		} catch {
			// Fallback to strict truthiness check if expression evaluation fails
			return Boolean(context[condition]);
		}
	}

	private _parseChoices(
		choices: TemplateQuestion["choices"],
	): Array<{ name: string; value: any }> {
		if (!choices) return [];

		if (Array.isArray(choices)) {
			return choices.map((c) => ({ name: String(c), value: c }));
		}

		// If choices is a Record<string, value>
		return Object.entries(choices).map(([label, val]) => ({
			name: `${label} (${val})`,
			value: val,
		}));
	}

	async promptForTemplateParameters(
		identifiedParams: string[],
		templateDefinedParams: string[],
		template: Template,
	): Promise<Record<string, any>> {
		const self = this;
		const answers: Record<string, any> = {};

		// Merge parameter keys while giving priority to order and avoiding duplicates
		const allParamKeys = Array.from(
			new Set([...templateDefinedParams, ...identifiedParams]),
		);

		for (const key of allParamKeys) {
			const rawQuestion = template[key] ?? template[key];
			const question: TemplateQuestion | undefined =
				typeof rawQuestion === "object" && rawQuestion !== null
					? (rawQuestion as TemplateQuestion)
					: undefined;

			// 1. Evaluate "when" condition
			if (question?.when !== undefined) {
				if (typeof question.when === "boolean" && !question.when) {
					continue;
				}
				if (typeof question.when === "string") {
					const shouldPrompt = this._evaluateWhenCondition(
						question.when,
						answers,
					);
					if (!shouldPrompt) {
						continue;
					}
				}
			}

			// Default message prompt label
			const message = question?.prompt || `Please provide value for ${key}:`;
			const defaultValue = question?.default;

			// 2. Determine prompt type based on TemplateQuestion configuration

			// Secret / Password Input
			if (question?.secret) {
				answers[key] = await inquirer.password({
					message,
					mask: "*",
				});
				continue;
			}

			// Multiline / Text Editor Input
			if (question?.multiline) {
				answers[key] = await inquirer.editor({
					message: message,
					default:
						defaultValue !== undefined ? String(defaultValue) : undefined,
					waitForUserInput: false,
				});
				continue;
			}

			// Select / Choice List
			if (question?.choices) {
				const parsedChoices = this._parseChoices(question.choices);
				answers[key] = await inquirer.select({
					message,
					choices: parsedChoices,
					default: defaultValue,
				});
				continue;
			}

			// Boolean Toggle Input
			if (question?.type === "bool") {
				answers[key] = await inquirer.confirm({
					message,
					default: typeof defaultValue === "boolean" ? defaultValue : true,
				});
				continue;
			}

			// Standard Text/String Input (Supports identifiedParams fallback & regex validation)
			const validateInput = (val: string) => {
				if (question?.validator) {
					const regex = new RegExp(question.validator);
					if (!regex.test(val)) {
						return (
							question.validator_error ||
							`Input does not match pattern: ${question.validator}`
						);
					}
				}
				return true;
			};

			const rawResult = await inquirer.input({
				message,
				default: defaultValue !== undefined ? String(defaultValue) : undefined,
				validate: validateInput,
			});

			// 3. Type casting for scalar/numeric values
			if (question?.type === "int") {
				answers[key] = parseInt(rawResult, 10);
			} else if (question?.type === "float") {
				answers[key] = parseFloat(rawResult);
			} else if (question?.type === "json") {
				try {
					answers[key] = JSON.parse(rawResult);
				} catch {
					answers[key] = rawResult;
				}
			} else {
				answers[key] = rawResult;
			}
		}

		return answers;
	}

	errorReadingTemplateConfigFile(key: string, templateFile: string): void {
		// TODO: add code
	}

	errorCannotDryRunInPresenceOfTriggers(): void {
		// TODO: add code
	}

	infoCreateDirectory(targetRoot: string): void {
		// TODO: add code
	}

	errorTemplateExtractionFailed(reason: string, data?: string): void {
		// TODO: add code
	}

	infoSkipFileOrDirectory(
		fType: "file" | "dir",
		fPath: string,
		reason: string,
	): void {
		// TODO: add code
	}

	infoCreateFile(fPath: string): void {
		// TODO: add code
	}

	successTemplateExtracted(key: string): void {
		// TODO: add code
	}

	infoInitiatingAllGenerationTasks(eventType: "Pre" | "Post"): void {
		// TODO: add code
	}

	errorInRenderingGenerationTaskCommand(
		command: string,
		errMessage: string,
	): void {
		// TODO: add code
	}

	infoInitiatingGenerationTask(index: number, command: string): void {
		// TODO: add code
	}

	errorExecutingGenerationTask(
		command: string,
		workingDir: string,
		errMessage: string,
	): void {
		// TODO: add code
	}

	infoCompletedGenerationTask(): void {
		// TODO: add code
	}

	infoCompletedAllGenerationTasks(eventType: "Pre" | "Post"): void {
		// TODO: add code
	}

	errorFailedToCompleteGenerationTasks(eventType: "Pre" | "Post"): void {
		// TODO: add code
	}
}
