export default [
	// Ignore build outputs and non-source files
	{
		ignores: ["dist/**", "node_modules/**", "coverage/**"],
	},

	// Base rules for JavaScript and TypeScript
	js.configs.recommended,
	...tseslint.configs.recommended,

	// Project-specific rules and environment
	{
		files: ["**/*.ts"],
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "module",
			globals: {
				...globals.node,
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Custom rule overrides
			"@typescript-eslint/no-explicit-any": "off",
			"@typescript-eslint/no-unused-vars": [
				"warn",
				{ argsIgnorePattern: "^_" },
			],
			"no-console": "off",
		},
	},

	// use biome for formatting
	biomeConfig,
];
