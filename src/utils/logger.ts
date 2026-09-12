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

export class Logger {
	static silentMode: boolean = false;

	static setSilentMode() {
		Logger.silentMode = true;
	}

	static info(message: string): void {
	  	if(!Logger.silentMode) console.log(`[INFO] ${message}`);
	}
  
	static success(message: string): void {
		if(!Logger.silentMode) console.log(`[SUCCESS] ${message}`);
	}
  
	static warn(message: string): void {
		if(!Logger.silentMode) console.warn(`[WARN] ${message}`);
	}
  
	static error(message: string, error?: unknown): void {
		if(!Logger.silentMode) console.error(`[ERROR] ${message}`, error ?? '');
	}
}