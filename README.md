# clone-org-repos

A simple utility script to clone all of an organization's repositories and branches therein.

## Usage

### Personal Access Token
Set your personal access token (used for API access) in the `GITHUB_TOKEN` environment variable.

### Defaults

```bash
npx @lukiffer/clone-org-repos --org "<ORG_NAME>"
```

### Custom Output Path

```bash
npx @lukiffer/clone-org-repos --org "<ORG_NAME>" --target-path "/path/to/destination"
```

### Custom SSH Key

By default, `~/.ssh/id_rsa` will be used. To use a different key, specify the `--ssh-key` argument.

```bash
npx @lukiffer@clone-org-repos --org "<ORG_NAME>" --ssh-key "/path/to/.ssh/key"
```
