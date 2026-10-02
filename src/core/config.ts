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
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import { Settings } from "./settings.js";

export class Config {
	static readonly DIRECTORY_NAME: string = ".bscaff";
	static readonly SNAPSHOT_DB_FILE: string = "db.json";
	static readonly SINGLE_FILE_NAME: string = "data";
	static readonly SETTINGS_FILE: string = "settings.json";
	static readonly TEMPLATE_CONFIG_FILE: string = "bscaff-template.yml";
	static readonly TEMPLATE_FILE_VERSION: string = "1.0.0";
	static readonly BSCAFF_USER_DIR_ENV_VARIABLE: string = "BSCAFF_USER_DIR";

	private static storagePath: string | null = null;

	static setStoragePath(sPath: string): void {
		Config.storagePath = FileUtils.resolvePath(sPath);
	}

	static getStoragePath(additional?: string[]): string {
		if (!Config.storagePath) {
			let sPath = MiscUtils.getEnvironmentVariable(
				Config.BSCAFF_USER_DIR_ENV_VARIABLE,
			);
			if (!sPath) {
				sPath = os.homedir();
			} else {
				sPath = FileUtils.resolvePath(sPath);
			}
			Config.storagePath = path.join(sPath, Config.DIRECTORY_NAME);
		}

		if (additional) {
			return path.join(Config.storagePath, ...additional);
		} else {
			return Config.storagePath;
		}
	}

	static async ensureStorageDirectoryExists(): Promise<boolean> {
		const sPath = Config.getStoragePath();

		try {
			await fs.mkdir(sPath, { recursive: true });
			return await Settings.initSettings();
		} catch {
			return false;
		}
	}
}
