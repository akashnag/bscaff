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
import chalk from "chalk";
import ora, { Ora } from "ora";
import { Config } from "../core/config.js";
import { YAMLParseError } from "../types/errors.js";
import { Template, TemplateQuestion } from "../types/template-types.js";
import * as FileUtils from "../utils/file-utils.js";
import {
	ConsoleIO,
	IOHeaderType,
	printBullet,
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
		if (QUIET_MODE) return;

		printHeader("Template File Missing");
		printField("Path", FileUtils.getRelativePath(repoPath));
		printField("Git Repo", isGit ? "Yes" : "No");
		printField("Error", "Required template configuration file was not found.");

		console.log("\nTo resolve:");
		printBullet(
			"Ensure the directory or repository contains a valid template file",
		);
		printBullet("Verify spelling and path existence\n");
	}

	errorExpectedZipFile(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("Invalid File Type");
		printField("Path", FileUtils.getRelativePath(filePath));
		printField("Error", "Expected a .zip archive file for this operation.");

		console.log("\nTo resolve:");
		printBullet("Provide a path pointing to a valid .zip file\n");
	}

	errorExtractingZip(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("Error Extracting Zip Archive");
		printField("Path", FileUtils.getRelativePath(filePath));
		printField(
			"Error",
			"Could not extract content from the provided zip archive.",
		);

		console.log("\nTo resolve:");
		printBullet("Check if the zip archive is corrupt or password protected");
		printBullet("Ensure sufficient permissions and disk space\n");
	}

	invalidTemplateZipFile(filePath: string): void {
		if (QUIET_MODE) return;

		printHeader("Invalid Template Zip Archive");
		printField("Path", FileUtils.getRelativePath(filePath));
		printField(
			"Error",
			"The zip archive does not contain a valid bscaff template structure.",
		);

		console.log("\nTo resolve:");
		printBullet(
			"Ensure the zip archive includes a valid template definition file\n",
		);
	}

	errorCannotUpdateNonGitTemplate(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Cannot Update Template");
		printField("Key", key);
		printField(
			"Error",
			"Only templates cloned from remote Git repositories can be updated automatically.",
		);

		console.log("\nTo resolve:");
		printBullet("Re-create or edit local templates directly\n");
	}

	successTemplateUpdated(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Template Updated Successfully", IOHeaderType.SUCCESS);
		printField("Key", key);
		console.log("");
	}

	successTemplateGitRepoAlreadyLatest(
		key: string,
		url: string,
		version: string,
	): void {
		if (QUIET_MODE) return;

		printHeader("Template Already Up-to-Date", IOHeaderType.INFO);
		printField("Key", key);
		printField("URL", url);
		printField("Version", version);
		console.log("");
	}

	errorCreatingTemplateDueToInvalidTemplateFormat(): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Save Template");
		printField(
			"Error",
			"The template structure or configuration file contains formatting errors.",
		);

		console.log("\nTo resolve:");
		printBullet(
			"Fix syntax errors in the template configuration file and try again\n",
		);
	}
}

// --------------------------------------------------------
// template verify <path>
// --------------------------------------------------------
export class VerifyTemplateIO extends ConsoleIO {
	errorParsingTemplateFileContent(): void {
		if (QUIET_MODE) return;

		printHeader("Failed to Parse Template Configuration");
		printField(
			"Error",
			"Unable to parse the content of the template configuration file.",
		);

		console.log("\nTo resolve:");
		printBullet(
			"Verify JSON/YAML syntax in your template configuration file\n",
		);
	}

	successTemplateVerified(): void {
		if (QUIET_MODE) return;

		printHeader("Template Verification Passed", IOHeaderType.SUCCESS);
		printField("Status", "The template structure and syntax are valid.\n");
	}

	errorDuringTemplateParsing(err: YAMLParseError): void {
		if (QUIET_MODE) return;

		printHeader("Template Verification Failed");
		if (err.lineNumber !== undefined) {
			printField("Line", String(err.lineNumber));
		}
		printField("Error", err.message);

		console.log("\nTo resolve:");
		printBullet("Correct the indicated template configuration error\n");
	}

	warnTemplateSubdirectoryDoesNotExist(dirPath: string): void {
		if (QUIET_MODE) return;

		printHeader("Subdirectory Missing", IOHeaderType.WARNING);
		printField("Path", dirPath);
		printField(
			"Warning",
			"The specified template subdirectory does not exist within the source structure.\n",
		);
	}
}

export class ExtractTemplateIO extends ConsoleIO {
	private activeSpinner: Ora | null = null;

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
		if (QUIET_MODE) return;

		printHeader("Error Reading Template Config");
		printField("Key", key);
		printField("File", templateFile);
		printField(
			"Error",
			"Could not read or locate the template configuration file.",
		);

		console.log("\nTo resolve:");
		printBullet("Verify that the template snapshot is not corrupted");
		printBullet(`Inspect files in snapshot using: bscaff list -k ${key}\n`);
	}

	errorCannotDryRunInPresenceOfTriggers(): void {
		if (QUIET_MODE) return;

		printHeader("Dry Run Not Supported");
		printField(
			"Error",
			"Dry run mode cannot be executed because this template includes generation tasks/triggers.",
		);

		console.log("\nTo resolve:");
		printBullet("Run extraction without the dry-run flag\n");
	}

	infoCreateDirectory(targetRoot: string): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgGreen.black.bold(" CREATE ");
		printIndented(`${tag} ${targetRoot}/`);
	}

	errorTemplateExtractionFailed(reason: string, data?: string): void {
		if (QUIET_MODE) return;

		printHeader("Template Extraction Failed");
		printField("Error", reason);
		if (data) {
			printField("Details", data);
		}

		console.log("\nTo resolve:");
		printBullet(
			"Check destination directory permissions and available space\n",
		);
	}

	infoSkipFileOrDirectory(
		fType: "file" | "dir",
		fPath: string,
		reason: string,
	): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgYellow.black.bold(" SKIP ");
		const suffix = fType === "dir" ? "/" : "";
		printIndented(`${tag} ${fPath}${suffix} (${reason})`);
	}

	infoCreateFile(fPath: string): void {
		if (QUIET_MODE) return;

		const tag = chalk.bgGreen.black.bold(" CREATE ");
		printIndented(`${tag} ${fPath}`);
	}

	successTemplateExtracted(key: string): void {
		if (QUIET_MODE) return;

		printHeader("Template Extracted Successfully", IOHeaderType.SUCCESS);
		printField("Key", key);
		console.log("");
	}

	infoInitiatingAllGenerationTasks(eventType: "Pre" | "Post"): void {
		if (QUIET_MODE) return;

		printHeader(`Initiating ${eventType}-Generation Tasks`, IOHeaderType.INFO);
	}

	errorInRenderingGenerationTaskCommand(
		command: string,
		errMessage: string,
	): void {
		if (QUIET_MODE) return;

		printHeader("Task Command Render Error");
		printField("Command", command);
		printField("Error", errMessage);

		console.log("\nTo resolve:");
		printBullet("Check template variable expressions in task command\n");
	}

	infoInitiatingGenerationTask(index: number, command: string): void {
		if (QUIET_MODE) return;

		this.activeSpinner = ora({
			text: `Executing task [${index}]: ${command}`,
			color: "cyan",
		}).start();
	}

	errorExecutingGenerationTask(
		command: string,
		workingDir: string,
		errMessage: string,
	): void {
		if (this.activeSpinner) {
			this.activeSpinner.fail(`Failed task: ${command}`);
			this.activeSpinner = null;
		}

		if (QUIET_MODE) return;

		printHeader("Generation Task Failed");
		printField("Command", command);
		printField("Working Dir", workingDir);
		printField("Error", errMessage);

		console.log("\nTo resolve:");
		printBullet(
			"Verify command availability and working directory permissions\n",
		);
	}

	infoCompletedGenerationTask(): void {
		if (this.activeSpinner) {
			this.activeSpinner.succeed();
			this.activeSpinner = null;
		}
	}

	infoCompletedAllGenerationTasks(eventType: "Pre" | "Post"): void {
		if (QUIET_MODE) return;

		printHeader(
			`Completed All ${eventType}-Generation Tasks`,
			IOHeaderType.SUCCESS,
		);
	}

	errorFailedToCompleteGenerationTasks(eventType: "Pre" | "Post"): void {
		if (QUIET_MODE) return;

		printHeader(`Failed ${eventType}-Generation Tasks`);
		printField(
			"Error",
			`One or more ${eventType.toLowerCase()}-generation tasks failed to complete successfully.\n`,
		);
	}
}
