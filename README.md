<p align="center">
  <img src="docs/images/bscaff-logo_with_wordmark_small.png" alt="bscaff" width="600">
</p>

---

**A cross-platform project scaffolding and developer template toolkit.**

Save project structures, files, directories, code, Git repositories, URLs, and reusable templates — then quickly recall and use them whenever you need them.

bscaff is designed around a simple idea:

> **Build it once. Save it. Reuse it.**

Whether you are starting a new project, reusing a familiar directory structure, keeping useful code snippets, or turning an AI-generated project tree into an actual project, bscaff provides a single CLI for the workflow.

## Installation

Requires **Node.js >= 22.11.0**.

```bash
npm install -g @akashnag/bscaff
```

Verify the installation:

```bash
bscaff --version
```

View available commands:

```bash
bscaff --help
```

## Quick Start

### Save a project

Save an existing directory as a reusable snapshot:

```bash
bscaff --key my-project --save-dir ./my-project
```

### Create a project from a snapshot

Extract it whenever you need it:

```bash
bscaff --key my-project --extract ./new-project
```

### List saved snapshots

```bash
bscaff --list
```

### Inspect a snapshot

```bash
bscaff --key my-project --list
```

### Display saved content

```bash
bscaff --key my-config --display
```

### Edit a saved snapshot

```bash
bscaff --key my-config --edit
```

---

## What can bscaff do?

### Project scaffolding

Save and recreate complete project structures, including directories and files.

```bash
bscaff --key node-api --save-dir ./node-api
bscaff --key node-api --extract ./new-api
```

File and directory names, as well as text file contents, can contain variables using the `{{ variable }}` syntax.

---

### Reusable templates

Create reusable `.bs_template` files from existing directories.

```bash
bscaff --key web-app --create-template ./web-app
```

Templates can later be stored, shared, and used as project scaffolding resources.

---

### Save anything you frequently reuse

bscaff can store more than complete projects.

Save:
- directories
- multiple files
- individual files
- text from files
- live text input
- URLs
- Git repositories
- project trees

For example:

```bash
bscaff --key dockerfile --save-file ./Dockerfile

bscaff --key common-utils --save-multi ./utils.ts ./constants.ts

bscaff --key useful-url --save-url https://example.com/docs
```

---

### AI-assisted project scaffolding

bscaff can turn a project tree copied from an AI coding tool directly into a real directory structure.

For example, if your clipboard contains:

```
my-app/
├── src/
│   ├── index.ts
│   └── utils.ts
├── package.json
└── README.md
```

you can create the structure directly:

```bash
bscaff --create-tree ./my-app
```

You can also have bscaff prompt for the contents of the files as they are created.

This makes it easy to move from an AI-generated project outline to an actual project on disk without manually creating every directory and file.

---

### Reuse with variables

bscaff supports:

`{{ variable }}`

replacement in:
- file names
- directory names
- text file contents

This allows a single saved project to serve as the foundation for many different projects.

For example:

```
{{ projectName }}/
├── src/
│   ├── {{ projectName }}.ts
│   └── utils.ts
├── package.json
└── README.md
```

Variable replacement can be controlled through `settings.json`.

---

### Git-based templates

A Git repository can be saved as a reusable bscaff snapshot:

```bash
bscaff --key my-template --save-git https://github.com/example/project.git
```

The repository contents are captured without the `.git` directory.

The saved template can then be extracted into a new location whenever required.

---

### File and snippet utilities

Saved content can be used directly from the command line.

For example:

```bash
bscaff --key config --copy
```

copies saved content to the clipboard.

Append or prepend saved text to existing files:

```bash
bscaff --key header --append ./README.md
bscaff --key header --prepend ./README.md
```

Saved files and text can also be opened for editing or inspection.

---

### Pre- and post-extraction scripts

Templates can optionally define scripts to run before and after extraction.

```bash
bscaff \
  --key my-project \
  --save-dir ./my-project \
  --pre-extract ./before.sh \
  --post-extract ./after.sh
```

This makes it possible to add project-specific setup or cleanup steps around the scaffolding process.

---

### Cross-platform

bscaff is designed to work across:
- Linux
- macOS
- Windows

Platform-specific editor, browser and terminal preferences can be configured through the bscaff settings file.

---

### Configuration

bscaff stores its data and configuration under:

```
~/.bscaff/
```

The configuration file is:

```
~/.bscaff/settings.json
```

A typical configuration looks like:

```json
{
  "editorPreference": "terminal",
  "terminalEditor": "nano",
  "guiEditor": "gedit",
  "browser": "google-chrome",
  "excludePatternReplacementInFileContent": []
}
```

Run:

```bash
bscaff --settings
```

to open the settings file for editing.

For the complete configuration reference, see the [feature documentation](docs/FEATURES.md).

---

### Documentation

Detailed documentation for individual features and workflows is available in:

- [FEATURES.md](docs/FEATURES.md) — detailed feature reference
- [CONTRIBUTING.md](docs/CONTRIBUTING.md) — contribution guidelines

---

### Contributing

Contributions, improvements, documentation updates, bug reports, and feature discussions are welcome.

Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for contribution guidelines and development information.

---

### License

bscaff is distributed under the **GNU General Public License v2.0**.
