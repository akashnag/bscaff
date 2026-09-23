# Features

This document provides a detailed reference for the features available in bscaff.

For installation and a quick overview, see [README.md](../README.md).

---

## Contents

- [Snapshots](#snapshots)
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
- [Clipboard](#clipboard)
- [Editing](#editing)
- [Opening Saved Content](#opening-saved-content)
- [Appending and Prepending](#appending-and-prepending)
- [Listing Snapshots](#listing-snapshots)
- [Renaming and Deleting](#renaming-and-deleting)
- [Overwrite Protection](#overwrite-protection)
- [Pre- and Post-Extraction Scripts](#pre--and-post-extraction-scripts)
- [Quiet Mode](#quiet-mode)
- [Settings](#settings)

---

## Snapshots

The fundamental unit in bscaff is a **snapshot**.

A snapshot is a named piece of reusable content stored by bscaff and identified by a unique key.

For example:

```bash
bscaff --key my-project --save-dir ./my-project
```

creates a snapshot named:

```
my-project
```

The snapshot can subsequently be inspected, edited, copied, extracted, or otherwise manipulated.

A snapshot can represent different types of content, including:

- directories
- multiple files
- individual files
- text
- URLs
- Git repositories
- project trees
- templates

This allows bscaff to serve both as a project scaffolding system and as a general-purpose repository for reusable developer resources.

---

## Project Scaffolding

A complete project directory can be captured and later recreated.

### Save

```bash
bscaff --key my-project --save-dir ./my-project
```

### Extract

```bash
bscaff --key my-project --extract ./new-project
```

The extracted directory contains the saved project structure and files.

This is useful for maintaining reusable starting points for applications, libraries, services, scripts, tools, documentation projects, and other types of software.

---

## Directories

Save an entire directory:

```bash
bscaff --key web-project --save-dir ./web-project
```

The directory structure and its files are stored as a snapshot.

The source directory can optionally be accompanied by a description:

```bash
bscaff \
  --key web-project \
  --desc "Base structure for web projects" \
  --save-dir ./web-project
```

---

## Multiple Files

Multiple files can be saved together as a single snapshot:

```bash
bscaff \
  --key common-config \
  --save-multi ./eslint.config.js ./tsconfig.json ./package.json
```

This is useful when a group of files is normally reused together but does not require an entire project directory.

---

## Files and Text

### Save a file

```bash
bscaff --key dockerfile --save-file ./Dockerfile
```

### Save text from a file

```bash
bscaff --key readme-template --save-text ./README.md
```

The distinction allows a file to either be treated as a reusable file artifact or its textual contents to be stored as reusable text.

---

## Live Input

Text can be entered directly into bscaff:

```bash
bscaff --key my-snippet --save-input
```

A file type can optionally be specified:

```bash
bscaff --key my-snippet --save-input ts
```

This is useful for small pieces of code or text that do not already exist in a file and you want to insert this later in a file. Mentioning the file-type will allow your text-editor to show syntax highlighting as you edit this snapshot.

---

## URLs

URLs can be stored as snapshots:

```bash
bscaff --key typescript-docs --save-url https://www.typescriptlang.org/docs/
```

bscaff stores the URL itself rather than downloading the contents of the resource.

A saved URL can later be opened directly in the browser:

```bash
bscaff --key typescript-docs --open
```

---

## Git Repositories

> **Note:** this requires git to be installed on your system

A Git repository can be captured as a reusable snapshot:

```bash
bscaff \
  --key project-template \
  --save-git https://github.com/example/project.git
```

bscaff clones the repository contents into the snapshot.

The .git directory is excluded, so the resulting snapshot represents the project itself rather than its Git history and metadata.

Optional pre- and post-extraction scripts can also be associated with Git-based templates.

---

## Templates

bscaff supports its own custom template format using the `.bs_template` extension.

### Create a template

```bash
bscaff --key web-app --create-template ./web-app
```

A template can also preserve file contents:

```bash
bscaff \
  --key web-app \
  --create-template-with-content ./web-app
```

Templates provide a convenient way to package reusable project structures for later use.

---

## Project Trees

bscaff can create project structures from a textual directory tree.

For example:

```
my-app/
├── src/
│   ├── index.ts
│   └── utils.ts
├── package.json
└── README.md
```

The tree can be supplied through the clipboard.

This makes it possible to take a project structure produced elsewhere and turn it directly into a directory structure.

### Create a tree

```bash
bscaff --create-tree ./my-app
```

bscaff reads the tree from the clipboard and creates the corresponding directories and files.

### AI-Assisted Scaffolding

Project trees are particularly useful when working with AI coding assistants.

An AI tool can produce a structure such as:

```
weather-service/
├── src/
│   ├── api/
│   │   └── weather.ts
│   ├── config/
│   │   └── index.ts
│   └── index.ts
├── tests/
│   └── weather.test.ts
├── package.json
└── README.md
```

The tree can be copied to the clipboard and passed directly to bscaff.

```bash
bscaff --create-tree ./weather-service
```

For workflows where file contents should also be generated interactively:

```bash
bscaff --create-tree-with-content ./weather-service
```

In this mode, bscaff prompts for the contents of the files while creating the structure.

This provides a simple bridge between a generated project outline and an actual filesystem structure.

---

## Variable Replacement

bscaff supports variable replacement using: `{{ variable }}`

Variables can occur in both paths and file contents.

For example:

```
{{ projectName }}/
├── src/
│   ├── {{ projectName }}.ts
│   └── utils.ts
├── package.json
└── README.md
```

A variable can also appear inside a file:

```ts
export class {{ className }} {
    // ...
}
```

During extraction or template creation, bscaff resolves the variables and creates the resulting paths and contents.

This allows a single snapshot to serve as the basis for multiple projects.

### Excluding files from content replacement

Variable replacement in file contents can be controlled through:

```json
{
  "excludePatternReplacementInFileContent": []
}
```

Patterns placed in this setting can be used to exclude matching files from content replacement.

Path and file-name replacement remains available independently.

---

## Displaying Saved Content

Saved snapshots can be displayed without extracting them.

```bash
bscaff --key my-snippet --display
```

For saved text or files, this provides a convenient way to inspect the stored content.

---

## Extracting Snapshots

A snapshot can be extracted to any destination path:

```bash
bscaff --key my-project --extract ./new-project
```

If the destination already exists, bscaff protects it from accidental overwriting.

To explicitly allow overwriting:

```bash
bscaff \
  --key my-project \
  --extract ./new-project \
  --overwrite
```

---

## Clipboard

Saved snapshots can be copied directly to the system clipboard:

```bash
bscaff --key my-snippet --copy
```

This is useful for code, configuration, documentation, commands, and other text-based resources.

---

## Editing

A saved snapshot can be opened for editing:

```bash
bscaff --key my-snippet --edit
```

The editor used is determined by the configured editor preferences.

---

## Opening Saved Content

The `--open` option provides a convenient way to open saved resources.

For saved URLs:

```bash
bscaff --key documentation --open
```

the URL is opened in the configured browser.

For saved files or text, the content is opened in the configured editor in read-only mode.

---

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

---

## Listing Snapshots

List all saved snapshots:

```bash
bscaff --list
```

List the contents of a specific snapshot:

```bash
bscaff --key my-project --list
```

This provides a quick way to inspect the structure of a stored project without extracting it.

---

## Renaming and Deleting

### Rename

```bash
bscaff --key old-name --rename new-name
```

### Delete

```bash
bscaff --key old-name --delete
```

---

## Overwrite Protection

bscaff does not overwrite an existing destination by default.

When an operation would replace an existing file or directory, use `--overwrite` to explicitly permit the operation.

For example:

```bash
bscaff --key my-project --extract ./existing-project --overwrite
```

This provides an additional safeguard when using scaffolding commands in existing workspaces.

These operations modify the stored snapshot rather than the original source files from which it was created.

---

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

---

## Quiet Mode

bscaff can operate without printing normal output:

```bash
bscaff --key my-project --extract ./new-project --quiet
```

This is useful when bscaff is being incorporated into other scripts or automated workflows.

--

## Settings

bscaff stores its data and configuration under:

```
~/.bscaff/
```

The main settings file is:

```
~/.bscaff/settings.json
```

The settings file can be opened directly:

```bash
bscaff --settings
```

A typical configuration is:

```json
{
  "editorPreference": "terminal",
  "terminalEditor": "nano",
  "guiEditor": "gedit",
  "browser": "google-chrome",
  "excludePatternReplacementInFileContent": []
}
```


#### `editorPreference`

Controls whether bscaff prefers the terminal editor or GUI editor.

Example:

```json
"editorPreference": "terminal"
```

#### `terminalEditor`

Specifies the terminal editor used by bscaff.

Example:

```json
"terminalEditor": "nano"
```

#### `guiEditor`

Specifies the GUI editor used by bscaff.

Example:

```json
"guiEditor": "gedit"
```

#### `browser`

Specifies the browser used when opening saved URLs.

Example:

```json
"browser": "google-chrome"
```

#### `excludePatternReplacementInFileContent`

Specifies patterns for files that should be excluded from `{{ variable }}` replacement inside file contents.

Example:

```json
"excludePatternReplacementInFileContent": [
  "*.lock",
  "*.min.js"
]
```

---

## Command Reference

The following options are available through the CLI.

### General

```
-k, --key <key>
--desc <description>
-q, --quiet
-s, --settings
-h, --help
-V, --version
```

### Saving

```
--save-dir <path>
--create-template <path>
--create-template-with-content <path>
--save-multi <files...>
--save-text <file>
--save-file <file>
--save-input [file_type]
--save-url <url>
--save-git <repo_url>
--save-tree [template_file]
```

### Retrieving and using snapshots

```
-d, --display [relative_path]
-x, --extract <path>
-c, --copy
-e, --edit
-o, --open
-a, --append <path...>
-p, --prepend <path...>
```

### Project tree creation

```
--create-tree <path>
--create-tree-with-content <path>
```

### Snapshot management

```
-l, --list
-r, --rename <new_key>
--delete
```

### Extraction options

```
--overwrite
--pre-extract <path-to-script-file>
--post-extract <path-to-script-file>
```

---

## Data and Storage

bscaff maintains its local data under:

```
~/.bscaff/
```

The directory contains the saved snapshots and configuration required by bscaff.

The storage location and internal representation are implementation details of bscaff; users should interact with stored resources through the CLI wherever possible.

---

## Cross-Platform Support

bscaff is designed as a cross-platform CLI and supports:

- Linux
- macOS
- Windows

Some operations, particularly editors, browsers, and extraction scripts, naturally depend on the tools available on the host operating system.

These platform-specific preferences can be configured through `settings.json`.

---

## Summary

bscaff provides a single workflow for capturing and reusing developer resources:

```
                  ┌─────────────────┐
                  │   Existing      │
                  │   resources     │
                  └────────┬────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │    Save     │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
                    │   bscaff    │
                    │   snapshot  │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
          Extract        Copy          Edit
             │             │             │
             ▼             ▼             ▼
         Project        Clipboard     Modified
         structure       content      resource
```

The same system can be used for complete projects, individual files, reusable text, templates, Git repositories, URLs, and AI-generated project structures.

For the project overview and installation instructions, see [README.md](../README.md)
