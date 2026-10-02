import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only search for test files inside the top-level /tests folder
		include: ["tests/**/*.spec.ts"],

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
