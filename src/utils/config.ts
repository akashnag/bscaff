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

import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { Settings } from '../core/settings.js';

export class Config {
	static readonly DIRECTORY_NAME: string = '.bscaff';
	static readonly SNIPPET_DB_FILE: string = 'db.json';
	static readonly SNIPPET_TEXT_FILE: string = 'snippet';
	static readonly SETTINGS_FILE: string = "settings.json";

	static getStoragePath(additional: string[] | null = null): string {
		// return base storage directory (e.g., ~/.bscaff)
		if(additional)
			return path.join(os.homedir(), Config.DIRECTORY_NAME, ...additional);
		else
			return path.join(os.homedir(), Config.DIRECTORY_NAME);
	}

	static formPath(items: string[]): string {
		return path.join(...items);
	}

	static async ensureStorageDirectoryExists(): Promise<boolean> {
		const storagePath = Config.getStoragePath();
		
		try {
			await fs.mkdir(storagePath, { recursive: true });
			return Settings.initSettings();
		} catch {
			return false;
		}
	}
}
