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

import * as MiscUtils from "../utils/misc-utils.js";

export class Logger {
	private static silentMode: boolean;

	static setSilentMode() {
		Logger.silentMode = true;
	}

	info(message: string): void {
		if (!Logger.silentMode) console.log(`[INFO] ${message}`);
	}

	success(message: string): void {
		if (!Logger.silentMode) console.log(`[SUCCESS] ${message}`);
	}

	warn(message: string): void {
		if (!Logger.silentMode) console.warn(`[WARN] ${message}`);
	}

	error(message: string, error?: unknown): void {
		if (!Logger.silentMode)
			console.error(
				`[ERROR] ${MiscUtils.getCallerName()}: ${message}`,
				error ?? "",
			);
	}
}
