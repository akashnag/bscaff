import { exec } from "node:child_process";
import { promisify } from "node:util";
import * as MiscUtils from "../utils/misc-utils.js";

const execAsync = promisify(exec);

export class ClipboardManager {
	async copy(text: string): Promise<void> {
		const platform = MiscUtils.getPlatform();

		if (platform === "darwin") {
			const child = exec("pbcopy");
			child.stdin?.write(text);
			child.stdin?.end();
			return;
		}

		if (platform === "win32") {
			// Windows clip command expects text piped via stdin
			const child = exec("clip");
			child.stdin?.write(text);
			child.stdin?.end();
			return;
		}

		if (platform === "linux") {
			// Try xclip first, fallback to wl-copy (Wayland) if available
			try {
				const child = exec("xclip -selection clipboard");
				child.stdin?.write(text);
				child.stdin?.end();
				return;
			} catch {
				const child = exec("wl-copy");
				child.stdin?.write(text);
				child.stdin?.end();
				return;
			}
		}

		throw new Error(`Clipboard copy is not supported on platform: ${platform}`);
	}

	async paste(): Promise<string> {
		const platform = MiscUtils.getPlatform();

		if (platform === "darwin") {
			const { stdout } = await execAsync("pbpaste");
			return stdout;
		}

		if (platform === "win32") {
			const { stdout } = await execAsync('powershell -command "Get-Clipboard"');
			return stdout.trimEnd();
		}

		if (platform === "linux") {
			try {
				const { stdout } = await execAsync("xclip -selection clipboard -o");
				return stdout;
			} catch {
				const { stdout } = await execAsync("wl-paste");
				return stdout;
			}
		}

		throw new Error(
			`Clipboard paste is not supported on platform: ${platform}`,
		);
	}
}
