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
import { Config } from "../utils/config.js";
import * as FileUtils from "../utils/files.js";
import * as MiscUtils from "../utils/misc.js";

export class Settings {
	static readonly DEFAULT_SETTINGS: BScaffSettings = {
		textEditor: MiscUtils.getPlatform() == "win32" ? "notepad" : "nano",
		browser: "google-chrome",
		excludeFromContentModification: "*.html;*.j2",
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
		if (!Object.hasOwn(Settings.DEFAULT_SETTINGS, key)) return false;
		Settings.settings[key as keyof BScaffSettings] = value;
		return FileUtils.writeTextFile(
			Settings.settingsFile,
			JSON.stringify(Settings.settings, null, 2),
		);
	}

	static get(key: string): string | null {
		if (!Object.hasOwn(Settings.DEFAULT_SETTINGS, key)) return null;
		return Settings.settings[key as keyof BScaffSettings];
	}
}
