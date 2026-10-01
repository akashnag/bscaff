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

import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { execa, type Options } from "execa";
import { cleanupDir, createTempDir } from "./fs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Entry points
export const CLI_DIST_PATH = path.resolve(__dirname, "../../dist/index.js");
export const CLI_SRC_PATH = path.resolve(__dirname, "../../src/index.ts");
export const CLI_BIN_PATH = path.resolve(__dirname, "../../bin/index.js");

export const CLI_PATH = CLI_DIST_PATH;

export const TEST_DIR = path.join(os.tmpdir(), "bscaff-test-sandbox");

// Set of tracked test directories for cleanup
const trackedDirs: Set<string> = new Set();

/**
 * Creates the test directory and an isolated .home folder, tracking it for cleanup.
 *
 * @returns The absolute path of the created directory
 */
export async function createTestDir(): Promise<string> {
	await cleanupDir(TEST_DIR);
	await fsp.mkdir(TEST_DIR, { recursive: true });
	const homeDir = path.join(TEST_DIR, ".home");
	await fsp.mkdir(homeDir, { recursive: true });
	trackedDirs.add(TEST_DIR);
	return TEST_DIR;
}

/**
 * Cleans up all tracked temporary directories.
 */
export async function cleanupTestDir(): Promise<void> {
	await cleanupDir(TEST_DIR);
	for (const dir of trackedDirs) {
		await cleanupDir(dir);
	}
	trackedDirs.clear();
}

/**
 * Strips ANSI escape codes (colors, styling, cursor movement) from CLI output strings.
 *
 * Essential for making assertions on stdout/stderr reliable and color-agnostic.
 */
export function stripAnsi(text: string): string {
	return text.replace(
		// eslint-disable-next-line no-control-regex
		/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
		"",
	);
}

/**
 * Options for executing the CLI in tests.
 */
export interface RunCLIOptions {
	/** Working directory for the command */
	cwd?: string;
	/** Isolated HOME directory for the command (defaults to an isolated directory if in a workspace) */
	homeDir?: string;
	/** Extra environment variables */
	env?: Record<string, string>;
	/** Input string or lines to pipe to stdin (e.g. for prompts) */
	input?: string | string[];
	/** Command timeout in milliseconds */
	timeout?: number;
	/** Strip ANSI escape codes from stdout and stderr in the result (default: true) */
	stripAnsiOutput?: boolean;
}

/**
 * Structured result of a CLI command execution.
 */
export interface CLIExecutionResult {
	/** Process exit code */
	exitCode: number;
	/** Standard output (ANSI-stripped by default) */
	stdout: string;
	/** Standard error (ANSI-stripped by default) */
	stderr: string;
	/** Raw standard output with escape codes preserved */
	rawStdout: string;
	/** Raw standard error with escape codes preserved */
	rawStderr: string;
	/** True if exitCode === 0 */
	success: boolean;
}

/**
 * Determines whether to execute the compiled distribution JS or run through tsx.
 */
export function getCLICommand(): { command: string; argsPrefix: string[] } {
	if (fs.existsSync(CLI_DIST_PATH)) {
		return { command: "node", argsPrefix: [CLI_DIST_PATH] };
	}
	// Fallback to tsx for direct TypeScript execution if not yet built
	return { command: "npx", argsPrefix: ["tsx", CLI_SRC_PATH] };
}

/**
 * Low-level execution helper using execa.
 *
 * @param args - CLI arguments (e.g. ["-k", "my-key", "save", "files", "main.go"])
 * @param cwd - Current working directory
 * @param options - Additional execa options
 */
export function executeCLI(
	args: string[],
	cwd: string,
	options: Options = {},
): ReturnType<typeof execa> {
	const { command, argsPrefix } = getCLICommand();
	const defaultHome = path.join(cwd, ".home");
	const env: Record<string, string> = {
		HOME: defaultHome,
		USERPROFILE: defaultHome,
		...(process.env as Record<string, string>),
		...(options.env as Record<string, string>),
	};
	return execa(command, [...argsPrefix, ...args], {
		cwd,
		reject: false,
		...options,
		env,
	});
}

/**
 * High-level CLI runner that provides:
 * - Isolation of HOME / USERPROFILE (protecting developer's ~/.bscaff)
 * - ANSI stripping of stdout and stderr
 * - Formatted return object with exitCode and success flag
 *
 * @param args - CLI argument array
 * @param options - Run options including isolated homeDir and cwd
 */
export async function runCLI(
	args: string[],
	options: RunCLIOptions = {},
): Promise<CLIExecutionResult> {
	const cwd = options.cwd ?? process.cwd();
	const env: Record<string, string> = {
		...(process.env as Record<string, string>),
		...options.env,
	};

	if (options.homeDir) {
		env.HOME = options.homeDir;
		env.USERPROFILE = options.homeDir;
	}

	let stdinContent: string | undefined = undefined;
	if (options.input !== undefined) {
		stdinContent = Array.isArray(options.input)
			? options.input.join("\n") + "\n"
			: options.input;
	}

	const execaOpts: Options = {
		cwd,
		env,
		timeout: options.timeout,
		reject: false,
		...(stdinContent !== undefined ? { input: stdinContent } : {}),
	};

	const result = await executeCLI(args, cwd, execaOpts);

	const rawStdout: string =
		typeof result.stdout === "string"
			? result.stdout
			: result.stdout
				? String(result.stdout)
				: "";
	const rawStderr: string =
		typeof result.stderr === "string"
			? result.stderr
			: result.stderr
				? String(result.stderr)
				: "";
	const shouldStrip = options.stripAnsiOutput !== false;
	const exitCode: number = typeof result.exitCode === "number" ? result.exitCode : 0;

	return {
		exitCode,
		stdout: shouldStrip ? stripAnsi(rawStdout) : rawStdout,
		stderr: shouldStrip ? stripAnsi(rawStderr) : rawStderr,
		rawStdout,
		rawStderr,
		success: exitCode === 0,
	};
}

/**
 * Executes a CLI command feeding a sequence of responses to interactive prompts via stdin.
 *
 * @param args - CLI arguments
 * @param inputs - Array of prompt responses to send in sequence
 * @param options - Additional execution options
 */
export async function runCLIWithInput(
	args: string[],
	inputs: string[],
	options: RunCLIOptions = {},
): Promise<CLIExecutionResult> {
	return runCLI(args, {
		...options,
		input: inputs,
	});
}

/**
 * An isolated test sandbox environment for running end-to-end CLI tests safely.
 */
export interface TestWorkspace {
	/** Root path of the entire sandbox */
	root: string;
	/** Isolated HOME directory; bscaff will create `.bscaff` here */
	homeDir: string;
	/** Path to the isolated `.bscaff` storage directory */
	storageDir: string;
	/** Working directory (cwd) for commands */
	cwd: string;
	/** Default directory for extracting scaffolds */
	targetDir: string;
	/** Directory for storing template fixtures */
	templatesDir: string;
	/** Run a CLI command pre-configured with this workspace's cwd and isolated HOME */
	runCLI(args: string[], options?: RunCLIOptions): Promise<CLIExecutionResult>;
	/** Run a CLI command with stdin answers */
	runCLIWithInput(
		args: string[],
		inputs: string[],
		options?: RunCLIOptions,
	): Promise<CLIExecutionResult>;
	/** Clean up the entire workspace and all temp directories */
	cleanup(): Promise<void>;
}

/**
 * Creates an isolated test workspace with dedicated HOME and working directories.
 *
 * Ensures tests never touch the user's real `~/.bscaff` directory and do not interfere
 * with concurrent test executions.
 *
 * @param prefix - Temporary folder prefix
 */
export async function createTestWorkspace(
	prefix = "bscaff-ws-",
): Promise<TestWorkspace> {
	const root = await createTempDir(prefix);
	const homeDir = path.join(root, "home");
	const cwd = path.join(root, "work");
	const targetDir = path.join(root, "target");
	const templatesDir = path.join(root, "templates");
	const storageDir = path.join(homeDir, ".bscaff");

	await fsp.mkdir(homeDir, { recursive: true });
	await fsp.mkdir(cwd, { recursive: true });
	await fsp.mkdir(targetDir, { recursive: true });
	await fsp.mkdir(templatesDir, { recursive: true });

	const workspace: TestWorkspace = {
		root,
		homeDir,
		storageDir,
		cwd,
		targetDir,
		templatesDir,
		runCLI(args: string[], options: RunCLIOptions = {}) {
			return runCLI(args, {
				cwd: options.cwd ?? cwd,
				homeDir: options.homeDir ?? homeDir,
				...options,
			});
		},
		runCLIWithInput(
			args: string[],
			inputs: string[],
			options: RunCLIOptions = {},
		) {
			return runCLIWithInput(args, inputs, {
				cwd: options.cwd ?? cwd,
				homeDir: options.homeDir ?? homeDir,
				...options,
			});
		},
		async cleanup() {
			await cleanupDir(root);
		},
	};

	return workspace;
}

export * from "./clipboard.js";
// Re-export all specialized test helpers so tests can import everything from `helpers/cli.js`
export * from "./fs.js";
export * from "./git.js";
export * from "./store.js";
export * from "./template.js";
