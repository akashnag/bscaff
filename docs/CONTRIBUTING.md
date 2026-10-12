# Contributing to bscaff

Thank you for your interest in contributing to **bscaff**.

bscaff is an open-source project, and contributions of many kinds are welcome. You do not need to contribute code to make a valuable contribution. Documentation improvements, tests, bug reports, examples, and feedback are all important.

Please read this guide before opening an issue or pull request.

## Ways to Contribute

Contributions are welcome in several forms.

In general, the project values contributions in roughly this order:

1. **Documentation improvements**
2. **Tests and test coverage**
3. **Bug fixes**
4. **Examples and usability improvements**
5. **New features**

This is not a strict ranking. It reflects a preference for contributions that improve the reliability, usability, and maintainability of the project without unnecessarily increasing its complexity.

Some particularly useful contributions include:

* Improving or clarifying documentation
* Adding end-to-end tests
* Improving test coverage for existing functionality
* Finding and fixing bugs
* Improving error messages and CLI usability
* Adding examples and usage documentation
* Reporting confusing behaviour or edge cases
* Reviewing proposed features and pull requests

## Before You Start

### Bug fixes and documentation

For small documentation changes, tests, and straightforward bug fixes, you can generally begin work directly.

For larger bug fixes where the intended behaviour is unclear, open an issue first so the expected behaviour can be discussed.

### New features

**Please discuss new features before starting implementation or opening a pull request.**

This is especially important for changes that:

* Add a new command or command group
* Change the CLI interface
* Introduce a new configuration mechanism
* Change template or project-generation behaviour
* Add a new external dependency
* Introduce a new abstraction or architectural pattern
* Change existing behaviour in a potentially breaking way

Open an issue describing the proposed feature and the problem it solves. Include examples of the intended CLI usage where appropriate.

This allows the design and scope to be discussed before significant implementation work begins.

A pull request implementing a previously unapproved feature may be closed or asked to be redesigned before it is reviewed.

## Development Setup

bscaff is a Node.js / TypeScript project.

Make sure you have a supported version of Node.js installed. The project currently requires:

* **Node.js >= 22.11.0**

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd bscaff
npm install
```

Before making changes, make sure the existing test suite passes:

```bash
npm test
```

Also run the project's linting and formatting checks before submitting a pull request.

Refer to `package.json` for the current available scripts.

## Project Structure

The source code is organized by responsibility.

When adding or modifying functionality, follow the existing project structure rather than introducing new architectural patterns without discussion.

In particular:

```text
src/
├── io/
│   └── ...
└── ...
```

The `src/io/` directory contains the project's I/O classes.

### I/O Abstraction

**All I/O operations must be performed through the appropriate classes in `src/io/`.**

Do not introduce direct filesystem, process, console, clipboard, or other external I/O into business-logic classes when an appropriate I/O abstraction exists.

For example, business logic should not directly perform operations such as:

* Reading or writing files
* Checking filesystem state
* Creating or removing directories
* Executing external processes
* Reading from or writing to the console
* Accessing the clipboard
* Other environment-dependent operations

Instead, use or extend the appropriate I/O class in `src/io/`.

If the required I/O abstraction does not exist, add one in `src/io/` rather than bypassing the abstraction.

This separation is important for:

* Testability
* Consistent user-facing output
* Keeping business logic independent of the environment
* Easier future changes to I/O behaviour

If a new I/O abstraction would represent a significant architectural change, discuss it before implementation.

## TypeScript and Code Style

The project uses:

* **TypeScript**
* **ESLint**
* **Biome**

Follow the conventions already established in the codebase.

Before submitting a pull request, run the relevant linting and formatting checks and ensure there are no new warnings or errors.

### General guidelines

Prefer:

* Clear, descriptive names
* Small, focused functions and classes
* Explicit types where they improve readability
* Existing project abstractions over introducing parallel implementations
* Simple solutions over unnecessary abstraction
* Reusable functionality over duplicated logic

Avoid:

* Unnecessary dependencies
* Premature abstraction
* Large unrelated refactors
* Dead code
* Commenting obvious code instead of making the code itself clear
* Mixing unrelated changes into a pull request

Do not reformat unrelated files merely because you are modifying one file.

## Testing

Tests are an important part of the project.

The project uses **Vitest**.

### Configuring SSH

Create a file: `ssh-config.json` in the root of your project directory, with the following data:

```json
{
	"sshProfile": "github.com"
}
```

Replace `github.com` with your SSH profile name, as configured in `~/.ssh/config` (on Linux systems). Without this, all tests of features involving git repos will fail.

### Prefer end-to-end tests

**End-to-end tests are preferred over unit tests wherever practical.**

bscaff is a CLI application, so testing complete user-facing workflows generally provides more value than testing implementation details in isolation.

When adding or changing functionality, first consider whether the behaviour can be tested through the CLI as a complete workflow.

For example, prefer testing:

```text
command → application logic → filesystem/output → expected result
```

over testing every individual internal function independently.

Unit tests are still appropriate when:

* A piece of logic is genuinely isolated
* An algorithm has many edge cases
* Testing the behaviour end-to-end would be unnecessarily expensive or difficult
* A unit test provides substantially clearer coverage

Do not add unit tests solely to increase the number of tests.

### When fixing a bug

Whenever practical, add a test that reproduces the bug before or alongside the fix.

The test should verify the expected user-visible behaviour and prevent the regression from returning.

### Test isolation

Tests should not depend on:

* A developer's local filesystem
* Existing files outside the test environment
* A particular working directory
* Developer-specific configuration
* Network services unless the test explicitly requires them
* Execution order of other tests

Use temporary directories and controlled test data where appropriate.

## Documentation

Documentation contributions are strongly encouraged.

Good documentation is particularly valuable for a CLI tool because users should be able to understand what a command does without reading its implementation.

Documentation improvements can include:

* README improvements
* Command and option documentation
* Examples
* Tutorials
* Troubleshooting information
* Clarifying existing behaviour
* Documenting edge cases
* Improving error-message explanations
* Fixing spelling or grammar

When adding a feature, documentation should normally be updated as part of the same contribution.

## Pull Requests

Before opening a pull request:

1. Make sure the change has an appropriate issue or prior discussion when required.
2. Keep the pull request focused on one logical change.
3. Add or update tests where appropriate.
4. Update documentation where behaviour or user-facing functionality changes.
5. Run the test suite.
6. Run linting and formatting checks.
7. Review your own diff for unrelated changes.
8. Make sure no generated files, credentials, local configuration, or temporary files are included.

### Pull request description

A pull request should explain:

* What changed
* Why the change was needed
* How the change works at a high level
* How it was tested
* Any important design decisions
* Any limitations or follow-up work

For user-facing changes, include example CLI commands where useful.

### Keep pull requests focused

Avoid combining unrelated changes such as:

* A feature and a large refactor
* A bug fix and unrelated formatting changes
* Multiple unrelated features
* Dependency upgrades unrelated to the change

Smaller, focused pull requests are easier to review and less likely to introduce unintended changes.

## Commits

Write clear commit messages that describe the change.

Keep commits reasonably focused. Avoid committing temporary debugging code, generated artifacts, editor files, or unrelated changes.

There is no requirement to squash commits before opening a pull request unless requested during review.

## Dependencies

Avoid adding dependencies unless they provide meaningful value.

Before introducing a new dependency, consider:

* Whether the functionality can reasonably be implemented using existing dependencies or Node.js APIs
* The maintenance status of the dependency
* Its licence
* Its size and transitive dependencies
* Whether it introduces unnecessary security or maintenance concerns

For significant new dependencies, discuss the proposal before implementation.

## Backwards Compatibility

Because bscaff is a CLI application, changes to commands, options, configuration, template formats, generated output, or other user-facing behaviour can affect existing users.

Consider backwards compatibility when modifying existing behaviour.

If a change is intentionally breaking, clearly document:

* What is changing
* Why it is changing
* Who is affected
* What users need to do to migrate

Do not silently change established behaviour when a migration or compatibility strategy is required.

## Error Handling

Errors should be useful to users and consistent with the rest of the application.

When adding or modifying errors:

* Prefer clear, actionable messages
* Avoid exposing unnecessary implementation details
* Preserve useful underlying error information where appropriate
* Use the project's existing I/O abstractions for presenting errors
* Do not silently swallow errors unless there is an explicit reason to do so

If an error can be prevented through validation, prefer validating the input before performing the operation.

## Security

Please do not publicly disclose security vulnerabilities through ordinary GitHub issues or pull requests.

If you discover a potential security vulnerability, use the project's designated private security-reporting mechanism if one is provided in the repository.

Do not include:

* Credentials
* API keys
* Personal information
* Private configuration
* Sensitive files

in issues or pull requests.

## Licence

bscaff is distributed under the **GNU General Public License, version 2.0 only (GPL-2.0-only)**.

By contributing to this project, you agree that your contributions may be distributed under the same licence, subject to the terms of the GPL-2.0-only licence.

Please do not submit code copied from projects with incompatible licences.

If you are unsure whether a piece of code, documentation, or other material can be contributed, ask before submitting it.

## Code of Conduct

Contributors are expected to communicate respectfully and constructively.

Be considerate of other contributors, reviewers, and users. Technical disagreements are welcome; personal attacks and disrespectful behaviour are not.

Please follow our code of conduct as described in [Code of Conduct](CODE_OF_CONDUCT.md).

## Questions and Discussions

If you are unsure whether an idea fits the project, **ask before implementing it**.

For new features in particular, opening a discussion first can save considerable implementation and review effort.

When asking a question or proposing a change, provide enough context for others to understand:

* The problem you are trying to solve
* The current behaviour
* The desired behaviour
* Examples, where applicable
* Any alternatives you have considered

Thank you for helping make bscaff more useful, reliable, and maintainable.
