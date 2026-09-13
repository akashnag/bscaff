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
import { FileUtils } from './file-utils.js';

export class Config {
	static readonly DIRECTORY_NAME: string = '.bscaff';
	static readonly SNIPPET_DB_FILE: string = 'db.json';
	static readonly SNIPPET_TEXT_FILE: string = 'snippet';
	static readonly SETTINGS_FILE: string = "settings.json";

	static readonly DEFAULT_SETTINGS = {
		"editorPreference": "terminal",
		"terminalEditor": "nano",
		"guiEditor": "gedit",
		"browser": "google-chrome"
	};

	static getStoragePath(additional: string[] | null = null): string {
		// return base storage directory (e.g., ~/.bscaff)
		if(additional)
			return path.join(os.homedir(), Config.DIRECTORY_NAME, ...additional);
		else
			return path.join(os.homedir(), Config.DIRECTORY_NAME);
	}

	static async ensureStorageDirectoryExists(): Promise<boolean> {
		const storagePath = Config.getStoragePath();
		const settingsFile = Config.getStoragePath([ Config.SETTINGS_FILE ]);

		try {
			await fs.mkdir(storagePath, { recursive: true });
			if(!FileUtils.doesFileExist(settingsFile)) {
				return FileUtils.writeTextFile(settingsFile, JSON.stringify(Config.DEFAULT_SETTINGS, null, 2));
			}
			return true;
		} catch (err: any) {
			return false;
		}
	}
}
