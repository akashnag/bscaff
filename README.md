<p align="center">
  <img src="docs/images/bscaff-logo_with_wordmark_small.png" alt="bscaff" width="600">
</p>

---

> [!WARNING]
> This CLI tool is currently in an **unstable, pre-release state** and may contain critical bugs. 
> **Do not use in production** or for automated, mission-critical workflows. Command-line flags, configuration syntax, and outputs may change without notice.


**bscaff is a cross-platform project scaffolding and developer template toolkit.**

Save project structures, files, directories, code, Git repositories, URLs, and reusable templates — then quickly recall and use them whenever you need them.

bscaff is designed around a simple idea:

> **Build it once. Save it. Reuse it.**

Whether you are starting a new project, reusing a familiar directory structure, keeping useful code snippets, or turning an AI-generated project tree into an actual project, bscaff provides a single CLI for the workflow.

## Installation

Requires **Node.js >= 22.11.0**. Also requires **git >= 2.6** if you are working with templates.

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

## Building from Source

Follow these steps to build and run the CLI locally from the source code.

### Prerequisites

Ensure you have the following installed on your system:
* **Node.js**: `v22.11.0` or higher
* **npm**
* **git (v2.6+)** (if you would be working with templates)

### 1. Clone the Repository

Clone the project repository to your local machine:

```bash
git clone https://github.com/akashnag/bscaff.git
cd bscaff
```

### 2. Install Dependencies

Install the required package dependencies:

```bash
npm install
```

### 3. Build the Project

Compile the TypeScript source files into executable JavaScript:

```bash
npm run build
```

This will output the compiled code into the target distribution directory (`dist`).

---

### Running and Testing Locally

#### Option A: Link the CLI Globally (Recommended)
To run your built CLI command from anywhere in your terminal, create a global symlink:

```bash
npm link
```

Now you can run your CLI directly using its command name:

```bash
bscaff --help
```

To remove the link after testing, run:

```bash
npm unlink -g bscaff
```

#### Option B: Run Directly with Node
If you do not wish to link the package globally, execute the compiled entry point directly:

```bash
node dist/index.js --help
```

#### Option C: Development Mode (Hot Reloading)
For active development without building repeatedly:

```bash
npm run dev
```

## Quick Start

### Save a project

Save an existing directory as a reusable snapshot:

```bash
bscaff --key my-project save tree ./my-project
```

### Create a project from a snapshot

Extract it whenever you need it:

```bash
bscaff --key my-project extract ./new-project
```

### List saved snapshots

```bash
bscaff list
```

### Inspect a snapshot

```bash
bscaff --key my-project list
```

---

## What can bscaff do?

### Project scaffolding

Save and recreate complete project structures, including directories and files.

```bash
bscaff --key node-api save dir ./node-api
bscaff --key node-api extract ./new-api
```

File and directory names, as well as text file contents, can contain variables using the `{{ variable }}` syntax.

---

### Reusable templates

Create reusable templates from existing directories.

```bash
bscaff --key web-app template create ./web-app
```

Templates can later be stored, shared, and used as project scaffolding resources. Templates support variable prompts and executing commands prior-to/post generation.

---

### Save anything you frequently reuse

**bscaff** can store more than complete projects.

Save:
- directories
- multiple files
- individual files
- text from files / code snippets
- live text input
- URLs
- templates from git repositories / zip files

For example:

```bash
bscaff --key dockerfile save files ./Dockerfile

bscaff --key common-utils save files ./utils.ts ./constants.ts

bscaff --key useful-url save url https://example.com/docs
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
bscaff create tree ./my-app
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

Variable replacement can be controlled through `settings.yml`, or inside the template config file (`bscaff-template.config.yml`) for templates.

---

### Git-based templates

A Git repository can be saved as a reusable bscaff snapshot:

```bash
bscaff --key my-template template save https://github.com/example/project.git --source git
```

The repository contents are captured without the `.git` directory.

The saved template can then be extracted into a new location whenever required.

---

### File and snippet utilities

Saved content can be used directly from the command line.

For example:

```bash
bscaff --key config copy
```

copies saved content to the clipboard.

<!--
Append or prepend saved text to existing files:

```bash
bscaff --key header transform append ./README.md
bscaff --key header transform prepend ./README.md
```
-->

Saved files and text can also be opened for editing or inspection.

---

### Pre- and post-extraction scripts

Templates can optionally define scripts to run before and after extraction.

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
~/.bscaff/settings.yml
```

A typical configuration looks like:

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

Run:

```bash
bscaff settings
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

Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md) for contribution guidelines and development information.

---

### License

bscaff is distributed under the **GNU General Public License v2.0**.

---

Created by **Akash Nag**