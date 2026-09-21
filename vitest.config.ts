import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Only search for test files inside the top-level /tests folder
		include: ["tests/**/*.spec.ts"],

		// Expressly exclude build folders, node_modules, or fixtures
		exclude: ["**/node_modules/**", "**/dist/**", "tests/helpers/**"],
	},
});
