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
import { Store } from "../core/store.js";
import { SnapshotRecord, SnapshotType } from "../types/types.js";
import { Config } from "../utils/config.js";
import * as MiscUtils from "../utils/misc.js";
import * as SnapshotUtils from "../utils/snapshot.js";
import {
	ConsoleIO,
	IOHeaderType,
	printBullet,
	printErrorFooter,
	printField,
	printHeader,
	printIndented,
	printLinedHeader,
	printPreview,
	printSeparatorLine,
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

	warnNoItemsFound(sType: string | undefined, tags: string | undefined): void {
		if (QUIET_MODE) return;

		if (sType && !tags) {
			printHeader(`No items found for type: ${sType}`, IOHeaderType.WARNING);
		} else if (!sType && tags) {
			printHeader(
				`No items found with tags: #${tags.split(",").join(" #")}`,
				IOHeaderType.WARNING,
			);
		} else if (sType && tags) {
			printHeader(
				`No items found with the given criteria`,
				IOHeaderType.WARNING,
			);
		} else if (!sType && !tags) {
			printHeader(`No items found`, IOHeaderType.WARNING);
		}

		console.log(`You haven't saved any snapshots yet.`);

		console.log(`\nTo create your first snapshot:`);
		printIndented(`bscaff -k <key> --save-dir <path/to/dir>`);
		printErrorFooter();
	}

	async listSnapshots(
		store: Store,
		sType: string | undefined,
		tags: string | undefined,
		snapshots: SnapshotRecord[],
	): Promise<void> {
		const headingMapper: Record<string, string> = {
			template: "Saved Templates",
			snippet: "Saved Snippets",
			tree: "Saved Scaffolds",
			files: "Saved Files",
			url: "Saved Links",
		};

		const splitTags = tags ? tags.split(",").join(" #") : null;

		printHeader(
			(sType ? headingMapper[sType] : "Saved Snapshots") +
				(splitTags ? ` (#${splitTags})` : ""),
			IOHeaderType.INFO,
		);

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
				const url = SnapshotUtils.readContentFromSnapshotFile(
					item.key,
					`${Config.SINGLE_FILE_NAME}.url`,
				);
				row["URL"] = url;
			} else {
				row["SIZE"] = await SnapshotUtils.computeSnapshotSize(store, item.key);
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
		items: { key: string; updated: Date; type: SnapshotType }[],
	): void {
		const mapper: Record<SnapshotType, string> = {
			[SnapshotType.Tree]: "Trees",
			[SnapshotType.Template]: "Templates",
			[SnapshotType.Snippet]: "Snippets",
			[SnapshotType.Files]: "Files",
			[SnapshotType.URL]: "URLs",
		};

		const freq: Record<string, number> = {
			Templates: 0,
			Snippets: 0,
			Trees: 0,
			Files: 0,
			URLs: 0,
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

	listTemplateInfo(
		key: string,
		record: SnapshotRecord,
		fileContent: string,
	): void {
		// TODO: add code
	}

	async listSnippetInfo(
		key: string,
		record: SnapshotRecord,
		fileContent: string,
	): Promise<void> {
		printHeader("Snapshot Details [Snippet]", IOHeaderType.INFO);

		printField("Key", key);
		printField("Updated", record.modifiedAt!.toLocaleString());

		if (record.tags && record.tags.length > 0) {
			printField("Tags", "#" + record.tags.join(" #"));
		}

		const lines = MiscUtils.splitContentByLines(fileContent);
		printField("Size", `${lines.length} lines`);

		if (record.description) {
			printField("Desc.", record.description);
		}

		printLinedHeader("Preview");
		printPreview(lines);
		printSeparatorLine();

		console.log("\nQuick Actions:");
		printBullet(`Open snippet in text-editor : bscaff -k ${key} open`);
		printBullet(`Copy snippet to clipboard   : bscaff -k ${key} copy`);
	}

	listTreeOrFilesInfo(key: string, record: SnapshotRecord): void {
		// TODO: add code
	}

	listURLInfo(key: string, record: SnapshotRecord): void {
		printHeader("Snapshot Details [URL]", IOHeaderType.INFO);

		printField("Key", key);
		printField("Target URL", record.urlContent!);
		printField("Updated", record.modifiedAt!.toLocaleString());

		if (record.tags && record.tags.length > 0) {
			printField("Tags", "#" + record.tags.join(" #"));
		}

		if (record.description) {
			printField("Desc.", record.description);
		}

		console.log("\nQuick Actions:");
		printBullet(`Open in default browser : bscaff -k ${key} open`);
		printBullet(`Copy URL to clipboard   : bscaff -k ${key} copy`);
	}

	displayFileFromSnapshot(
		key: string,
		record: SnapshotRecord,
		relPath: string,
		fileContent: string,
	): void {
		// TODO: add code
	}
}
