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

import { CLI } from "./cli.js";
import { Config } from "./core/config.js";
import { ConsoleIO } from "./io/io.js";

import * as FileUtils from "./utils/file-utils.js";
import * as MiscUtils from "./utils/misc-utils.js";

async function main(): Promise<void> {
	const args = process.argv;

	try {
		if (await Config.ensureStorageDirectoryExists()) {
			const cli = new CLI();

			await cli.program.parseAsync(process.argv);
			log(args, true);
			process.exit(0);
		} else {
			throw new Error("Error initiating storage directory");
		}
	} catch (error: any) {
		log(args, false, error);
		process.exit(1);
	}
}

function log(args: string[], success: boolean, error?: any) {
	const now = new Date();
	let logEntry = `[${now.toISOString()}] bscaff ${args.slice(2).join(" ")} --> `;
	logEntry += success
		? "SUCCESS"
		: `FAILED (${MiscUtils.asSingleLineString(error)})`;
	FileUtils.appendToTextFile(Config.LOG_FILE_PATH, logEntry + "\n");
}

main();
