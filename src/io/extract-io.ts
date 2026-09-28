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

import { SnapshotType } from "../types/types.js";
import * as IOUtils from "./io.js";
import { ConsoleIO } from "./io.js";

export class CopySnapshotIO extends ConsoleIO {
	successSnapshotCopied(key: string, sType: SnapshotType): void {
		// TODO: add code
	}
}

export class OpenSnapshotIO extends ConsoleIO {
	errorOpeningURL(browser: string | null, url: string | undefined): void {
		// TODO: add code
	}
}
