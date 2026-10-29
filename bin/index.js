#!/usr/bin/env node

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

import process from "node:process";
import { spawnSync } from "child_process";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const entryPath = resolve(__dirname, "../dist/index.js");

// Extract command line arguments (skipping 'node' and script path)
const args = ["--no-warnings", entryPath, ...process.argv.slice(2)];

const result = spawnSync("node", args, { stdio: "inherit" });
process.exit(result.status ?? 0);
