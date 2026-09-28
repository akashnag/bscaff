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

import fs from "node:fs";
import path from "node:path";
import { CLI } from "../src/cli.js";

const OUTPUT_DIR = path.join(process.cwd(), "completions");
const program = new CLI().program;

if (!fs.existsSync(OUTPUT_DIR)) {
	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const name = program.name();
const commands = program.commands.map((cmd) => cmd.name());

// Extract subcommands and top-level flags
const flags = program.options
	.map((opt) => opt.long || opt.short)
	.filter(Boolean);
for (const cmd of program.commands) {
	cmd.options.forEach((opt) => {
		if (opt.long) flags.push(opt.long);
		if (opt.short) flags.push(opt.short);
	});
}
const uniqueFlags = [...new Set(flags)];

// 1. Generate Bash Completion
function generateBash() {
	return `\
_${name}_completions() {
	local cur prev opts
	COMPREPLY=()
	cur="\${COMP_WORDS[COMP_CWORD]}"
	prev="\${COMP_WORDS[COMP_CWORD-1]}"
	opts="${commands.join(" ")} ${uniqueFlags.join(" ")}"

	if [[ \${cur} == -* ]] ; then
		COMPREPLY=( $(compgen -W "${uniqueFlags.join(" ")}" -- \${cur}) )
		return 0
	fi

	COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
	return 0
}
complete -F _${name}_completions ${name}
`;
}

// 2. Generate Zsh Completion
function generateZsh() {
	const cmdDescriptions = program.commands
		.map(
			(cmd) =>
				`        '${cmd.name()}:${cmd.description().replace(/'/g, "'\\''")}'`,
		)
		.join("\n");

	return `\
#compdef ${name}

_${name}() {
    local -a commands
    commands=(
${cmdDescriptions}
    )

    _arguments -C \\
        '1: :->_cmds' \\
        '*::arg:->args'

    case $state in
        _cmds)
            _describe -t commands '${name} command' commands
            ;;
        args)
            case $line[1] in
${program.commands
	.map(
		(cmd) => `                ${cmd.name()})
                    _values 'flags' ${cmd.options.map((o) => `'${o.long || o.short}[${o.description}]'`).join(" ")}
                    ;;`,
	)
	.join("\n")}
            esac
            ;;
    esac
}

_${name} "$@"
`;
}

// 3. Generate Fish Completion
function generateFish() {
	let fishScript = `# Fish completion for ${name}\n\n`;

	// Subcommands
	for (const cmd of program.commands) {
		fishScript += `complete -c ${name} -n "__fish_use_subcommand" -a "${cmd.name()}" -d "${cmd.description()}"\n`;

		// Command-specific options
		for (const opt of cmd.options) {
			const shortFlag = opt.short ? `-s ${opt.short.replace("-", "")}` : "";
			const longFlag = opt.long ? `-l ${opt.long.replace("--", "")}` : "";
			fishScript += `complete -c ${name} -n "__fish_seen_subcommand_from ${cmd.name()}" ${shortFlag} ${longFlag} -d "${opt.description}"\n`;
		}
	}

	return fishScript;
}

// Write files out to /completions
fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.bash`), generateBash());
fs.writeFileSync(path.join(OUTPUT_DIR, `_${name}`), generateZsh()); // Zsh standard starts with _
fs.writeFileSync(path.join(OUTPUT_DIR, `${name}.fish`), generateFish());

console.log(`✅ Completion scripts generated in directory: ${OUTPUT_DIR}/`);
