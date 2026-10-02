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
import * as SpecialFileIOUtils from "../utils/special-file-io.js";
import { Config } from "./config.js";

export class Settings {
	static readonly DEFAULT_SETTINGS: BScaffSettings = {
		textEditor: MiscUtils.getPlatform() == "win32" ? "notepad" : "nano",
		browser: "google-chrome",
		exclude: [
			".git",
			".vscode",
			"node_modules",
			"__pycache__",
			".pytest_cache",
		],
		include: [],
		templatesSuffix: ".jinja",
	};

	static settings: BScaffSettings;
	static settingsFile: string;

	/**
	 * Helper to write current settings object to the settings YAML file.
	 */
	private static saveSettings(): boolean {
		const content = SpecialFileIOUtils.stringifyYaml(Settings.settings);
		return FileUtils.writeTextFile(Settings.settingsFile, content);
	}

	static async initSettings(): Promise<boolean> {
		Settings.settingsFile = Config.getStoragePath([Config.SETTINGS_FILE]);

		if (!FileUtils.doesFileExist(Settings.settingsFile)) {
			Settings.settings = { ...Settings.DEFAULT_SETTINGS };
			return Settings.saveSettings();
		}

		const parsed = await SpecialFileIOUtils.readYamlFile<
			Partial<BScaffSettings>
		>(Settings.settingsFile);
		Settings.settings = parsed
			? { ...Settings.DEFAULT_SETTINGS, ...parsed }
			: { ...Settings.DEFAULT_SETTINGS };
		return true;
	}

	static update(key: string, value: string): boolean {
		// Check if the string key actually exists on settings
		if (!(key in Settings.settings)) {
			return false;
		}

		const settingKey = key as keyof BScaffSettings;

		// Reject keys that are arrays/non-strings
		if (Array.isArray(Settings.settings[settingKey])) {
			return false;
		}

		// Safely update string properties
		(Settings.settings[settingKey] as string) = value;

		// Persist updated settings to YAML file
		return Settings.saveSettings();
	}

	static get<K extends keyof BScaffSettings>(key: K): BScaffSettings[K] | null {
		if (!Object.hasOwn(Settings.DEFAULT_SETTINGS, key)) return null;
		return this.settings[key];
	}
}
