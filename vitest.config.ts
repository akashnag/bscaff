import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// disable all parallelism
		fileParallelism: false,
		maxWorkers: 1,

		// print custom messages in tests
		silent: false,

		// Only search for test files in these places
		include: [
			"tests/end-to-end-tests/*.spec.ts",
			//"tests/end-to-end-tests/url-mgmt.spec.ts",
			//"tests/end-to-end-tests/snippet-mgmt.spec.ts",
			//"tests/end-to-end-tests/tree-and-files-mgmt.spec.ts",
			//"tests/end-to-end-tests/create-from-clipboard.spec.ts",
			//"tests/end-to-end-tests/search-and-misc.spec.ts",
			//"tests/end-to-end-tests/template-mgmt.spec.ts",
		],

		// Expressly exclude build folders, node_modules, or fixtures
		exclude: ["**/node_modules/**", "**/dist/**", "tests/helpers/**"],

		// Configure coverage behaviors
		coverage: {
			provider: "v8", // Explicitly use the native V8 provider
			reporter: ["text", "html", "json-summary"], // text for terminal, html for local review, json-summary for CI pipelines
			reportsDirectory: "./.test-coverage-reports",

			// Define what code to target
			include: ["src/**/*.ts"], // Track files in the source directory
			exclude: [
				"tests/**", // Exclude test files themselves
				"src/types/**", // Exclude pure TypeScript type definitions
				"src/utils/**",
				"src/core/**",
			],

			// Enforce strict coverage thresholds
			thresholds: {
				statements: 80, // Fails build if total statement coverage falls below 80%
				branches: 75, // Fails build if total branch coverage falls below 75%
				functions: 80,
				lines: 80,
				// autoUpdate: true,          // Automatically updates config thresholds to match current metrics
			},
		},
	},
});
