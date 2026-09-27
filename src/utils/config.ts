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

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Settings } from "../core/settings.js";

export class Config {
	static readonly DIRECTORY_NAME: string = ".bscaff";
	static readonly SNAPSHOT_DB_FILE: string = "db.json";
	static readonly SINGLE_FILE_NAME: string = "data";
	static readonly SETTINGS_FILE: string = "settings.json";
	static readonly TEMPLATE_CONFIG_FILE: string = "bscaff-template.yml";
	static readonly TEMPLATE_FILE_VERSION: string = "1.0.0";

	static getStoragePath(additional: string[] | null = null): string {
		// return base storage directory (e.g., ~/.bscaff)
		if (additional)
			return path.join(os.homedir(), Config.DIRECTORY_NAME, ...additional);
		else return path.join(os.homedir(), Config.DIRECTORY_NAME);
	}

	static async ensureStorageDirectoryExists(): Promise<boolean> {
		const storagePath = Config.getStoragePath();

		try {
			await fs.mkdir(storagePath, { recursive: true });
			return await Settings.initSettings();
		} catch {
			return false;
		}
	}
}
