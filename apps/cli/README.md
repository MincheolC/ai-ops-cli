# ai-ops-cli

CLI for managing AI tool rules and presets across projects.

## Install

```bash
npm install -g ai-ops-cli
```

## Usage

```bash
# Initialize rules for the current project
ai-ops init

# Check for updates
ai-ops diff

# Apply updates
ai-ops update
```

## Options

```
ai-ops [command] [options]

Commands:
  init     Initialize AI tool rules for a project
  update   Update installed rules
  diff     Show diff between installed and current rules

Options:
  --scope <scope>  Target scope: project (default) or global
  --force          Force update even when no changes detected
  -V, --version    Output the version number
  -h, --help       Display help
```

## License

MIT
