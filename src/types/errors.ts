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

export class ScriptMissingError extends Error {
	public readonly scriptType: "pre" | "post";
	public readonly path: string;

	constructor(scriptType: "pre" | "post", path: string) {
		super(`${scriptType}-script missing`);
		this.scriptType = scriptType;
		this.path = path;
	}
}

export class TemplateParseError extends Error {
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "TemplateParseError";
	}
}
