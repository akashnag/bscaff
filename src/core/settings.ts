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

import type { BScaffSettings } from "../types/types.js";
import * as FileUtils from "../utils/file-utils.js";
import * as MiscUtils from "../utils/misc-utils.js";
import { Config } from "./config.js";

export class Settings {
	static readonly DEFAULT_SETTINGS: BScaffSettings = {
		textEditor: MiscUtils.getPlatform() == "win32" ? "notepad" : "nano",
		browser: "google-chrome",
		excludeFromContentModification: "*.html;*.j2",
		excludeFromContentInputPrompt: "*.png;*.jpg;*.",
		excludeDirectories: [".git", ".vscode", "node_modules"],
	};

	static settings: BScaffSettings;
	static settingsFile: string;

	static async initSettings(): Promise<boolean> {
		Settings.settingsFile = Config.getStoragePath([Config.SETTINGS_FILE]);
		if (!FileUtils.doesFileExist(Settings.settingsFile)) {
			if (
				FileUtils.writeTextFile(
					Settings.settingsFile,
					JSON.stringify(Settings.DEFAULT_SETTINGS, null, 2),
				)
			) {
				Settings.settings = Settings.DEFAULT_SETTINGS;
			} else {
				return false;
			}
		} else {
			const content = await FileUtils.readTextFile(Settings.settingsFile);
			if (content) {
				Settings.settings = JSON.parse(content);
			} else {
				Settings.settings = Settings.DEFAULT_SETTINGS;
			}
		}
		return true;
	}

	static update(key: string, value: string): boolean {
		// Check if the string key actually exists on Settings
		if (!(key in this.settings)) {
			return false;
		}

		const settingKey = key as keyof Settings;

		// Reject keys that are arrays/non-strings (e.g. excludeDirectories)
		if (Array.isArray(this.settings[settingKey])) {
			return false;
		}

		// Safely update string properties
		(this.settings[settingKey] as string) = value;
		return true;
	}

	static get<K extends keyof BScaffSettings>(key: K): BScaffSettings[K] | null {
		if (!Object.hasOwn(Settings.DEFAULT_SETTINGS, key)) return null;
		return this.settings[key];
	}
}
