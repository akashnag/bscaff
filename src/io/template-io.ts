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

import { Config } from "../core/config.js";
import { TemplateParseError } from "../types/errors.js";
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
