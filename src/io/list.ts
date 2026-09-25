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

import chalk from "chalk";
import { SnippetRecord, SnippetType } from "../types/types.js";
import { Config } from "../utils/config.js";
import * as SnippetUtils from "../utils/snippet.js";
import {
	ConsoleIO,
	IOHeaderType,
	printBullet,
	printErrorFooter,
	printField,
	printHeader,
	printIndented,
	printTable,
	QUIET_MODE,
	SYMBOL_BULLET,
} from "./io.js";

export class ListSnapshotsIO extends ConsoleIO {
	errorMissingParameter(param: string): void {
		if (QUIET_MODE) return;

		super.errorMissingParameter(param);
		console.log(`Usage:`);
		printIndented(`bscaff --list <template|snippet|tree|files|url>`);
		console.log(`\nExample:`);
		printIndented(`bscaff --list url`);
		printErrorFooter();
	}

	warnNoItemsFound(sType: string): void {
		if (QUIET_MODE) return;

		printHeader(`No items found for type: ${sType}`, IOHeaderType.WARNING);
		console.log(`You haven't saved any snapshots yet.`);

		console.log(`\nTo create your first snapshot:`);
		printIndented(`bscaff -k <key> --save-dir <path/to/dir>`);
		printErrorFooter();
	}

	listSnapshots(sType: string, snapshots: SnippetRecord[]): void {
		const headingMapper: Record<string, string> = {
			template: "Saved Templates",
			snippet: "Saved Snippets [Code / Text]",
			tree: "Saved Scaffolds",
			files: "Saved Files",
			url: "Saved Links [URLs]",
		};

		printHeader(headingMapper[sType], IOHeaderType.INFO);
		printIndented(
			`Found ${snapshots.length} item(s) ${SYMBOL_BULLET} Sorted by key\n`,
		);

		const columns: { title: string; width?: number }[] = [
			{
				title: "KEY",
				width: 20,
			},
		];

		if (sType === "url") {
			columns.push({
				title: "URL",
				width: 40,
			});
		} else {
			columns.push({
				title: "SIZE",
				width: sType == "tree" ? 27 : 12,
			});
		}

		columns.push({ title: "TAGS" });

		const table: any[] = [];
		for (let i = 0; i < snapshots.length; ++i) {
			const item = snapshots[i];
			const row: any = { KEY: item.key };

			if (sType === "url") {
				const url = SnippetUtils.readContentFromSnippetFile(
					item.key,
					`${Config.SNIPPET_TEXT_FILE}.url`,
				);
				row["URL"] = url;
			} else {
				row["SIZE"] = SnippetUtils.computeSnippetSize(item.key, item.type);
			}

			if (item.tags) {
				row["TAGS"] = "#" + item.tags.join(" #");
			} else {
				row["TAGS"] = "-";
			}

			table.push(row);
		}

		printTable(columns, table, true);
	}

	showSnapshotInventory(
		items: { key: string; updated: Date; type: SnippetType }[],
	): void {
		const mapper: Record<SnippetType, string> = {
			[SnippetType.Directory]: "tree",
			[SnippetType.Tree]: "tree",
			[SnippetType.Template]: "template",
			[SnippetType.Text]: "snippet",
			[SnippetType.File]: "file/multi-file",
			[SnippetType.MultiFile]: "file/multi-file",
			[SnippetType.URL]: "URL",
		};

		const freq: Record<string, number> = {
			template: 0,
			snippet: 0,
			tree: 0,
			"file/multi-file": 0,
			URL: 0,
		};

		const columns = [
			{ title: "TYPE", width: 20 },
			{ title: "COUNT", width: 15 },
		];
		const table = [];

		for (let i = 0; i < items.length; ++i) {
			++freq[mapper[items[i].type]];
		}

		for (const key in freq) {
			table.push({
				TYPE: key,
				COUNT: freq[key],
			});
		}

		printHeader(
			`Saved Snapshots ${SYMBOL_BULLET} Found ${items.length} item(s)`,
			IOHeaderType.INFO,
		);

		printTable(columns, table, true);
	}
}
