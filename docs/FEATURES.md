# Features

This document provides a detailed reference for the features available in bscaff.

For installation and a quick overview, see [README.md](../README.md).

---

## Contents

- [Snapshots](#snapshots)
- [Tags and Metadata](#tags-and-metadata)
- [Project Scaffolding](#project-scaffolding)
- [Directories](#directories)
- [Multiple Files](#multiple-files)
- [Files and Text](#files-and-text)
- [Live Input](#live-input)
- [URLs](#urls)
- [Git Repositories](#git-repositories)
- [Templates](#templates)
- [Project Trees](#project-trees)
  - [AI-Assisted Scaffolding](#ai-assisted-scaffolding)
- [Variable Replacement](#variable-replacement)
- [Displaying Saved Content](#displaying-saved-content)
- [Extracting Snapshots](#extracting-snapshots)
- [Clipboard Operations](#clipboard-operations)
- [Editing Snapshots](#editing-snapshots)
- [Opening Saved Content](#opening-saved-content)
<!-- - [Appending and Prepending](#appending-and-prepending) -->
- [Searching and Listing Snapshots](#searching-and-listing-snapshots)
- [Updating Snapshots](#updating-snapshots)
- [Deleting Snapshots](#deleting-snapshots)
- [Overwrite & Exist Protection](#overwrite--exist-protection)
<!-- - [Pre- and Post-Extraction Scripts](#pre--and-post-extraction-scripts) -->
- [Quiet Mode](#quiet-mode)
- [Custom Storage Path](#custom-storage-path)
- [Settings](#settings)
- [Command Reference](#command-reference)

---

## Snapshots

The fundamental unit in bscaff is a **snapshot**.

A snapshot is a named piece of reusable content stored by bscaff and identified by a unique key specified via the global `-k` / `--key` flag.

For example:

```bash
bscaff -k my-project save tree ~/projects/my-react-app
```

creates a snapshot named `my-project`.

The snapshot can subsequently be inspected, edited, copied, extracted, updated, or deleted.

A snapshot can represent different types of content, including:

- directory trees (`tree`)
- multiple standalone files (`files`)
- individual code/text snippets (`snippet`)
- web URLs (`url`)
- template packages (`template`)

This allows bscaff to serve both as a project scaffolding system and as a general-purpose repository for reusable developer resources.

---

## Tags and Metadata

Every snapshot in bscaff can be annotated with metadata to make organization, retrieval, and filtering fast and intuitive:

- **Key (`-k, --key <key>`)**: The unique identifier for a snapshot.
- **Description (`--desc "<description>"`)**: A brief double-quoted explanation of what the snapshot contains or does.
- **Tags (`--tags <list-of-tags>`)**: A comma-separated list of tags (without spaces) used to categorize snapshots (e.g., `react,nextjs,typescript`).

Metadata can be attached when saving a snapshot:

```bash
bscaff -k react-app --desc "Base React boilerplate" --tags react,app save tree ~/projects/my-react-app
```

Or updated later using the `update` command suite:

```bash
bscaff -k react-app update desc "Updated React 19 boilerplate"
bscaff -k react-app update tags react,frontend,ts
```

---

## Project Scaffolding

A complete project directory can be captured and later recreated.

### Save

```bash
bscaff -k my-project save tree ~/projects/my-react-app
```

### Extract

```bash
bscaff -k my-project extract ./new-project
```

The extracted directory contains the saved project structure and files.

This is useful for maintaining reusable starting points for applications, libraries, services, scripts, tools, documentation projects, and other types of software.

---

## Directories

Save an entire directory tree specified by local path:

```bash
bscaff -k web-project --desc "Base structure for web projects" save tree ./web-project
```

The directory structure and its files are stored as a snapshot.

---

## Multiple Files

Multiple files can be saved together as a single snapshot under one key:

```bash
bscaff -k common-config save files ./eslint.config.js ./tsconfig.json ./package.json
```

This is useful when a group of files is normally reused together but does not require an entire project directory.

---

## Files and Text

### Save a file snippet

Save code or text from an existing file on disk:

```bash
bscaff -k react-component save snippet ./components/my-component.tsx
```

### Save text from clipboard

Copy text or code directly from the system clipboard into a snapshot using `--memory`:

```bash
bscaff -k react-component save snippet --memory --type tsx
```

The `--type` option signals the file extension or code syntax (e.g., `tsx`, `py`, `json`), enabling appropriate syntax highlighting when editing or viewing.

---

## Live Input

bscaff provides interactive terminal input for saving quick notes or code fragments.

```bash
bscaff -k my-snippet save snippet
```

If flags and path are omitted, bscaff opens a text editor for live content input.

### Direct Global Shortcut

Running `bscaff` with only a key flag acts as a quick shortcut for live text capture:

```bash
bscaff -k quick-note
```

This immediately triggers live input mode to quickly store ideas or code without typing subcommands.

---

## URLs

Web links and URLs can be stored directly as snapshots:

```bash
bscaff -k go-docs save url https://go.dev/doc/
```

If the URL parameter is omitted, bscaff automatically captures the URL currently in your system clipboard.

A saved URL can later be opened directly in your browser:

```bash
bscaff -k go-docs open
```

---

## Git Repositories

> **Note:** Requires `git` to be installed on your system.

A Git repository can be captured directly as a directory tree snapshot using the `--git` flag:

```bash
bscaff -k test-fork save tree https://github.com/akashnag/bscaff.git --git
```

bscaff clones the repository contents into the snapshot.

---

## Templates

bscaff supports custom template packages with variable processing and configuration rules.

### Verify a Template Config

Verify if a template configuration file is syntactically valid:

```bash
bscaff template verify ./template-config.yaml
```

### Save a Template

Save a template from a local directory, ZIP archive, or Git repo using the `--source` (`-s`) option:

```bash
# Save from local directory (default)
bscaff -k my-template template save ./my-template-dir

# Save from ZIP archive
bscaff -k my-template template save ./bscaff-react-template.zip --source zip

# Save from Git repository
bscaff -k my-template template save https://github.com/bscaff/bscaff-react-template.git --source git
```

In case you are saving from a zip archive, the zip must contain a single root folder, and all files including the template config must be present in that root folder.

### Generate Projects from Templates

#### From a Saved Template

Generate a project directory from a previously saved template:

```bash
bscaff -k my-template template generate-project projects/my-react-app
```

#### From a Directory directly

Generate a project directory from a directory containing a template config file:

```bash
bscaff template generate-project --from-dir my-templates/my-react-template projects/my-react-app
```

#### From a Zip Archive directly

Generate a project directory from a zip archive containing a template config file:

```bash
bscaff template generate-project --from-zip my-templates/my-react-template.zip projects/my-react-app
```

#### From a Git Repo directly

Generate a project directory from a git repo containing a template:

```bash
bscaff template generate-project --from-git https://github.com/username/my-react-template.git projects/my-react-app
```

#### Non-interactive Project Generation

During project generation, variables (parameters) will be prompted for input. If you wish to have non-interactive generation, use the `--json` flag, for example:

```bash
bscaff -k my-template template generate-project --json "$(cat param-values.json)" projects/my-react-app
```

This will take the parameter values from the json content of the file `param-values.json` (or whatever file you specify) instead of prompting for input.

### Create a Template from an Existing Directory

Automatically convert a directory into a saved bscaff template:

```bash
bscaff -k my-template template create projects/my-react-app
```

### Update a Saved Template

Update a saved template from its upstream Git repository:

```bash
bscaff -k my-template template update
```

### Template Configuration (`bscaff-template.config.yml`)

Every bscaff template requires a configuration file named `bscaff-template.config.yml` at the root of the template directory[cite: 3].

It defines template metadata, jinja/environment settings, pre/post-generation lifecycle tasks, migrations, and interactive user prompts (questions)[cite: 3].

---

#### Special Configuration Keys

All internal bscaff control keys begin with an underscore (`_`)[cite: 3].

| Key | Type | Description |
|---|---|---|
| `_min_bscaff_version` | `string` | Minimum required bscaff version required to execute this template[cite: 3]. |
| `_subdirectory` | `string` | Relative path if the template files reside inside a sub-folder rather than the root[cite: 3]. |
| `_answers_file` | `string` | Path where user answers are recorded for future template updates (default: `.bscaff-answers.yml`). |
| `_post_generation_message` | `string` | Message displayed in the terminal upon successful project scaffolding[cite: 3]. |
| `_templates_suffix` | `string` | File suffix used to identify template files (default: `.jinja`, customizable via `templatesSuffix` setting)[cite: 3]. |
| `_exclude` | `string[]` | Glob patterns to exclude completely from template processing[cite: 3]. |
| `_include` | `string[]` | Glob patterns to explicitly include even if matched by `_exclude`[cite: 3]. |
| `_skip_if_exists` | `string[]` | Files generated on initial setup that should never be overwritten during updates[cite: 3]. |
| `_pre_generation_tasks` | `string[]` | Shell commands executed before project generation[cite: 3]. |
| `_post_generation_tasks` | `string[]` | Shell commands executed after project generation[cite: 3]. |
| `_migrations` | `object[]` | List of version migration tasks executed sequentially during template updates[cite: 3]. |
| `_envops` | `object` | Custom Jinja parser delimiter and syntax overrides[cite: 3]. |

---

#### Environment Parser Settings (`_envops`)

Override default Jinja tag delimiters using `_envops`[cite: 3]:

| Property | Type | Default | Description |
|---|---|---|---|
| `block_start_string` | `string` | `{%` | Opening tag for control statements[cite: 3]. |
| `block_end_string` | `string` | `%}` | Closing tag for control statements[cite: 3]. |
| `variable_start_string` | `string` | `{{` | Opening tag for variable expressions[cite: 3]. |
| `variable_end_string` | `string` | `}}` | Closing tag for variable expressions[cite: 3]. |
| `comment_start_string` | `string` | `{#` | Opening tag for template comments[cite: 3]. |
| `comment_end_string` | `string` | `#}` | Closing tag for template comments[cite: 3]. |
| `autoescape` | `boolean` | `false` | Enables automatic HTML escaping[cite: 3]. |

---

#### User Prompts & Questions

Any top-level YAML key that **does not** start with an underscore (`_`) is treated as a user prompt definition[cite: 3].

##### Question Properties

| Property | Type | Description |
|---|---|---|
| `type` | `str` \| `int` \| `float` \| `bool` \| `json` \| `yaml` | Variable data type (default: `str`)[cite: 3]. |
| `prompt` | `string` | Question text displayed to the user during prompting[cite: 3]. |
| `default` | `any` | Default value if the user presses Enter[cite: 3]. |
| `choices` | `array` \| `object` | Allowed choices presented as a list or a map of key-value choices[cite: 3]. |
| `when` | `boolean` \| `string` | Condition evaluated to determine if this question should be asked[cite: 3]. |
| `validator` | `string` | Regex or expression used to validate user input[cite: 3]. |
| `validator_error` | `string` | Error message displayed when validation fails[cite: 3]. |
| `secret` | `boolean` | Hides input characters in the terminal (useful for API keys/passwords)[cite: 3]. |
| `multiline` | `boolean` | Enables multi-line input in the terminal[cite: 3]. |
| `placeholder` | `string` | Placeholder text shown in the prompt field[cite: 3]. |

---

#### Example `bscaff-template.config.yml`

```yaml
_min_bscaff_version: "1.0.0"
_answers_file: ".bscaff-answers.yml"
_templates_suffix: ".jinja"
_post_generation_message: "Project successfully initialized! Run `npm install` to get started."
_exclude:
  - ".git/*"
  - "node_modules/*"

_pre_generation_tasks:
  - "echo 'Preparing scaffolding...'"

_post_generation_tasks:
  - "git init"
  - "npm install"

project_name:
  type: str
  prompt: "What is the name of your project?"
  default: "my-app"

author_name:
  type: str
  prompt: "Author Name:"

use_typescript:
  type: bool
  prompt: "Use TypeScript?"
  default: true

database_driver:
  type: str
  prompt: "Select Database Engine:"
  choices:
    PostgreSQL: "pg"
    SQLite: "sqlite3"
    MySQL: "mysql2"
  when: "{{ use_typescript }}"

api_key:
  type: str
  prompt: "Enter Third-Party API Key:"
  secret: true
```

---

## Project Trees

bscaff can capture and create project directory structures using ASCII tree diagrams.

### Save ASCII Tree from Clipboard

Save an ASCII tree diagram copied to your clipboard directly into a snapshot:

```bash
bscaff -k ascii-scaffold save tree
```

Add `--prompt-for-content` to interactively input file contents for each file in the ASCII tree upon saving.

### Create Project Tree directly on Disk

Construct directories and files directly on disk from an ASCII tree on your clipboard without saving it as a snapshot first:

```bash
bscaff create tree ./my-app --prompt-for-content
```

### AI-Assisted Scaffolding

Project trees are exceptionally useful when working with AI coding assistants.

When an AI model generates an application structure:

```
weather-service/
├── src/
│   ├── api/
│   │   └── weather.ts
│   └── index.ts
├── tests/
│   └── weather.test.ts
└── package.json
```

Copy the text block to your clipboard and run:

```bash
bscaff create tree ./weather-service --prompt-for-content
```

bscaff parses the clipboard diagram, builds the folder hierarchy, and prompts you for content for each file.

---

## Variable Replacement

bscaff supports variable replacement using mustache syntax: `{{ variable }}`.

Variables can occur in both folder/file paths and file contents:

```
{{ projectName }}/
├── src/
│   ├── {{ projectName }}.ts
│   └── utils.ts
└── package.json
```

Inside files:

```ts
export class {{ className }} {
    // ...
}
```

During extraction, bscaff prompts for variable values and substitutes them across paths and contents.

---

## Displaying Saved Content

Inspect snapshot contents without extracting them to disk.

### Read-Only View in Default Application or Editor

Open a saved snippet or file read-only in your editor:

```bash
bscaff -k copyright-text open
```

Open a specific file within a saved tree snapshot:

```bash
bscaff -k react-project open docs/CONTRIBUTING.md
```

Force a file to open in a text editor or custom command:

```bash
bscaff -k react-project open docs/CONTRIBUTING.md --editor
bscaff -k react-project open docs/CONTRIBUTING.md --command "code"
```

---

## Extracting Snapshots

Extract saved tree or files to a destination directory:

```bash
bscaff -k my-project extract ./new-project
```

### Partial Extraction

Extract only a specific subfolder or single file from a large tree snapshot using `--partial`:

```bash
bscaff -k my-project extract ./output-folder --partial src/components
```

### Dry Run

Preview what files and directories will be created without making actual filesystem changes:

```bash
bscaff -k my-project extract ./new-project --dry-run
```

---

## Clipboard Operations

Copy snapshot contents or file structures directly to the system clipboard:

```bash
# Copy a text snippet to clipboard
bscaff -k header-snippet copy

# Copy a specific file's content from a tree snapshot
bscaff -k my-project copy src/index.ts

# Copy directory structure of a snapshot as an ASCII tree diagram
bscaff -k my-project copy --as-tree
```

You can also write content directly from the clipboard to a file on disk:

```bash
bscaff create file ./src/index.ts --overwrite
```

---

## Editing Snapshots

Update content stored within an existing snapshot using your configured editor:

```bash
# Edit a text snippet snapshot
bscaff -k copyright-text update content

# Edit a specific file inside a tree/files snapshot
bscaff -k react-project update content docs/CONTRIBUTING.md
```

---

## Opening Saved Content

The `open` command provides contextual resource launching:

- **URLs**: Opened in your default system web browser.
- **Snippets / Files**: Opened in read-only mode in your preferred text editor or default viewer.

```bash
bscaff -k my-docs open
```

<!--
## Appending and Prepending

Saved text can be inserted into existing files.

### Append

```bash
bscaff --key footer --append ./README.md
```

### Prepend

```bash
bscaff --key header --prepend ./README.md
```

Multiple destination files can be specified:

```bash
bscaff --key header --prepend ./README.md ./docs/README.md
```

This makes bscaff useful for maintaining reusable headers (e.g. copyright notices), footers, configuration blocks, documentation sections, and other text fragments.
-->

---

## Searching and Listing Snapshots

### List Snapshots

List all saved snapshots or inspect internal files of a specific snapshot:

```bash
# List all saved snapshots
bscaff list

# List contents of a specific snapshot key
bscaff -k react-project list

# List files in a subpath of a snapshot
bscaff -k react-project list src/components

# Filter listing by snapshot type or tags
bscaff list --type tree --tags react,frontend
```

### Search Snapshots

Search for snapshots using fuzzy key matching, description matching, type filtering, or tag filtering:

```bash
bscaff -k react search --desc "boilerplate" --type tree --tags frontend
```

---

## Updating Snapshots

bscaff provides subcommands under `update` to modify individual snapshot properties without resaving:

```bash
# Rename snapshot key
bscaff -k old-key update key new-key

# Update description
bscaff -k react-project update desc "Updated project description"

# Update tags
bscaff -k react-project update tags react,nextjs,typescript

# Update stored URL
bscaff -k google update url https://google.com

# Edit content of a snippet or file inside snapshot
bscaff -k react-project update content src/App.tsx
```

---

## Deleting Snapshots

Delete an entire snapshot or delete a specific file within a saved snapshot:

```bash
# Delete entire snapshot
bscaff -k copyright-text delete

# Force deletion without confirmation prompt
bscaff -k copyright-text delete --force

# Delete a specific file under a snapshot
bscaff -k react-project delete docs/OLD_NOTES.md
```

---

## Overwrite & Exist Protection

When writing or extracting files to disk, bscaff provides configurable protection modes to prevent accidental data loss.

### Multi-File & Directory Operations (`extract` and `create tree`)

For commands that extract or construct entire file trees, bscaff supports the `-e, --if-exists <behaviour>` option with four distinct choices:

- `prompt` *(default)*: Interactively ask what to do when a collision occurs.
- `overwrite`: Replace existing destination files.
- `skip`: Skip existing destination files and keep original disk content.
- `fail`: Instantly abort the operation if any target file exists.

```bash
bscaff -k my-project extract ./existing-dir --if-exists skip
bscaff create tree ./my-app --if-exists overwrite
```

### Single-File Operations (`create file`)

For single-file creation operations, destination handling is straightforward—use `-o, --overwrite` to explicitly allow replacing an existing file:

```bash
bscaff create file ./src/index.ts --overwrite
```

---

<!--
## Pre- and Post-Extraction Scripts

Directory and Git-based templates can have scripts executed before and after extraction.

```bash
bscaff \
  --key my-project \
  --extract ./new-project \
  --pre-extract ./before.sh \
  --post-extract ./after.sh
```

The scripts are executed by the host operating system.

Typical use cases include:
- preparing the destination
- creating supporting resources
- performing project-specific substitutions
- installing dependencies
- running initialization steps
- cleaning up generated artifacts

The script itself should be a text file appropriate for the target platform.

For example:

- shell scripts on Unix-like systems
- `.bat` or other appropriate command scripts on Windows
-->

## Quiet Mode

Suppress all normal console logging using `-q` / `--quiet` for silent execution:

```bash
bscaff -k my-project -q extract ./new-project
```

This is useful when embedding bscaff into shell scripts, CI/CD pipelines, or automated workflows.

---

## Custom Storage Path

By default, bscaff stores all snapshot data and settings in `~/.bscaff`.

You can override the storage root for any command using the global `--data-dir <path>` option:

```bash
bscaff --data-dir /Volumes/ExternalDrive -k my-project save tree ./my-app
```

This causes bscaff to save and read snapshots under `/Volumes/ExternalDrive/.bscaff`. If the specified path does not exist, bscaff logs an error and safely falls back to default storage.

---

## Settings

bscaff configuration is managed in `~/.bscaff/settings.json`.

To open settings for interactive editing in your text editor:

```bash
bscaff settings
```

Example `settings.yml`:

```yaml
textEditor: nano
browser: google-chrome
exclude:
  - .git
  - .vscode
  - node_modules
  - __pycache__
  - .pytest_cache
include: []
templatesSuffix: .jinja
```

- **`textEditor`**: Name/Command of the text editor to use for editing and creating snapshots.
- **`browser`**: Default browser for opening saved URLs.
- **`exclude`**: Glob patterns excluded from `{{ variable }}` processing during extraction.
- **`include`**: Glob patterns explicitly included (even if excluded by `exclude`) in `{{ variable }}` processing during extraction.

---

## Command Reference

This document provides a concise reference for all commands and options available in `bscaff`.

---

### Global Flags

| Command / Flag | Description |
| :--- | :--- |
| `-k, --key <key>` | Key identifying the snapshot. |
| `-q, --quiet` | Suppresses all normal console output for silent execution. |
| `--data-dir <path>` | Path to use for saving all data (stored under `<path>/.bscaff`). |
| `-h, --help` | Display help information for commands and options. |
| `-V, --version` | Output the version number of `bscaff`. |

---

### Save Commands (`bscaff save` / `bscaff -k <key> save`)

> **Options for the `save` group:**  
> `--desc "<description>"` — Set snapshot description  
> `--tags <tag1,tag2>` — Set comma-separated snapshot tags  

| Command | Description |
| :--- | :--- |
| `bscaff -k <key> save tree [dir-path]` | Save a local directory tree structure and its contents into a snapshot. |
| `bscaff -k <key> save tree <repo-url> --git` | Clone a Git repository and save it as a directory tree snapshot. |
| `bscaff -k <key> save tree` | Parse an ASCII tree diagram from clipboard and save as a snapshot. |
| `bscaff -k <key> save snippet [path/to/file]` | Save a code or text snippet from an existing file on disk. |
| `bscaff -k <key> save snippet --memory [--type <ext>]` | Save snippet text directly from system clipboard. |
| `bscaff -k <key> save snippet` | Open interactive text editor to input snippet text directly in terminal. |
| `bscaff -k <key> save files <file1> <file2> ...` | Save one or more standalone files into a single snapshot. |
| `bscaff -k <key> save url [url]` | Save a web URL as a snapshot (captures URL from clipboard if parameter is omitted). |

---

### Extract & Output Commands

| Command | Description |
| :--- | :--- |
| `bscaff -k <key> extract <dest-path>` | Extract tree, files, or template snapshot into a target directory. |
| `bscaff -k <key> extract <dest-path> --partial <subpath>` | Extract only a specific subfolder or single file from a snapshot. |
| `bscaff -k <key> extract <dest-path> --dry-run` | Preview files and directories that would be created without making changes to disk. |
| `bscaff -k <key> extract <dest-path> -e <behaviour>` | Set collision strategy (`prompt`, `overwrite`, `skip`, or `fail`). |
| `bscaff -k <key> copy` | Copy snapshot content directly to the system clipboard. |
| `bscaff -k <key> copy <rel-path>` | Copy specific file content within a tree snapshot to clipboard. |
| `bscaff -k <key> copy --as-tree` | Copy directory structure of a snapshot as an ASCII tree diagram to clipboard. |
| `bscaff -k <key> open` | Open saved URL in web browser or snippet/file in default viewer (read-only). |
| `bscaff -k <key> open <rel-path>` | Open specific file within a saved tree snapshot (read-only). |

---

### Create Commands (`bscaff create`)

| Command | Description |
| :--- | :--- |
| `bscaff create tree <dest-path>` | Construct directories and files on disk directly from an ASCII tree on system clipboard. |
| `bscaff create tree <dest-path> --prompt-for-content` | Prompt interactively for content of each file created from the ASCII tree. |
| `bscaff create tree <dest-path> -e <behaviour>` | Handle existing file collisions (`prompt`, `overwrite`, `skip`, or `fail`). |
| `bscaff create file <dest-path>` | Write clipboard content directly into a file on disk. |
| `bscaff create file <dest-path> -o, --overwrite` | Overwrite existing destination file when creating from clipboard content. |

---

### Template Commands (`bscaff template`)

| Command | Description |
| :--- | :--- |
| `bscaff template verify <path>` | Validate the syntax and configuration of a template configuration file. |
| `bscaff -k <key> template save <path>` | Save a template package from a local directory. |
| `bscaff -k <key> template save <path> -s, --source <dir\|zip\|git>` | Save a template from a local directory, ZIP archive, or Git repository. |
| `bscaff -k <key> template create <dir-path>` | Automatically convert an existing local directory into a saved template. |
| `bscaff -k <key> template update` | Pull and update a saved template from its upstream Git repository. |

---

### List & Search Commands

| Command | Description |
| :--- | :--- |
| `bscaff list` | List all saved snapshots with metadata. |
| `bscaff -k <key> list` | List all files inside a specific saved snapshot. |
| `bscaff -k <key> list <rel-path>` | List files within a specific subpath of a tree snapshot. |
| `bscaff list --type <type> --tags <tags>` | Filter list of snapshots by content type (`tree`, `files`, `snippet`, `url`, `template`) or tags. |
| `bscaff search` | Interactively search snapshots using fuzzy matching. |
| `bscaff -k <query> search` | Search snapshots matching key query string. |
| `bscaff search --desc <query> --tags <tags> --type <type>` | Perform targeted search across description, tags, or type filters. |

---

### Management & Update Commands

| Command | Description |
| :--- | :--- |
| `bscaff -k <old-key> update key <new-key>` | Rename a snapshot key identifier. |
| `bscaff -k <key> update desc "<description>"` | Update the description metadata of a snapshot. |
| `bscaff -k <key> update tags <tag1,tag2>` | Update the tags associated with a snapshot. |
| `bscaff -k <key> update url <new-url>` | Update the web URL stored under a URL snapshot. |
| `bscaff -k <key> update content` | Open interactive text editor to modify the content of a snippet snapshot. |
| `bscaff -k <key> update content <rel-path>` | Open interactive text editor to modify a specific file inside a tree or files snapshot. |
| `bscaff -k <key> delete` | Delete an entire snapshot key from storage. |
| `bscaff -k <key> delete <rel-path>` | Delete a specific file from within a saved tree snapshot. |
| `bscaff -k <key> delete --force` | Delete snapshot without prompting for confirmation. |
| `bscaff settings` | Open user configuration (`~/.bscaff/settings.json`) in system editor. |

---

## Data and Storage

bscaff maintains its local data under:

```
~/.bscaff/
```

(or `<data-dir>/.bscaff` when `--data-dir` is passed).

The directory contains saved snapshots and configuration settings. User interaction should be conducted through the CLI tool.

---

## Cross-Platform Support

bscaff is designed as a cross-platform CLI and supports:

- Linux
- macOS
- Windows

Platform tools (editors, web browsers) can be customized via `bscaff settings`.
