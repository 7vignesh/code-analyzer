# Universal Code Analyzer

You have a tool called `scan_codebase` that scans any repository and returns compressed **skeletons** — function signatures and types without the full implementation bodies.

## When to use it

Use `scan_codebase` before reading source files. It tells you which files are relevant and shows their structure without burning tokens on full file contents.

## Parameters

- `question` (**required**): what you want to understand, e.g. `"how are messages sent?"`
- `root` (**required**): absolute path to the repository, e.g. `/home/user/my-project`
- `limit`: how many files to return (default: 10)
- `modules`: narrow the search to specific modules or directories

## Example

```
scan_codebase({
  question: "How does the authentication flow work?",
  root: "/home/user/my-project",
  modules: ["auth"]
})
```

The response includes each file's path, relevance score, skeleton code, and token counts so you can decide what to read in full.
