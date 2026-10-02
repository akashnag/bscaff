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

async function main(): Promise<void> {
	try {
		if (await Config.ensureStorageDirectoryExists()) {
			const cli = new CLI();

			await cli.program.parseAsync(process.argv);
			process.exit(0);
		} else {
			throw new Error("File path issue");
		}
	} catch (error: any) {
		process.exit(1);
	}
}

main();
