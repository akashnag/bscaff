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
import { Config } from "./utils/config.js";
import { Logger } from "./utils/logger.js";

async function main(): Promise<void> {
	const logger = new Logger();

	try {
		if (await Config.ensureStorageDirectoryExists()) {
			const cli = new CLI();
			process.exit(await cli.parseArgsAndExecute(process.argv));
		} else {
			throw new Error("File path issue");
		}
	} catch (error: any) {
		logger.error("An unexpected error occurred during execution:", error);
		process.exit(1);
	}
}

main();
