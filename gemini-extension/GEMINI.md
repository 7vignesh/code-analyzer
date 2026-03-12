# Rocket.Chat Code Analyzer

You have a tool called `scan_codebase` that scans the Rocket.Chat TypeScript source and returns compressed **skeletons** — function signatures and types without the full implementation bodies.

## When to use it

Use `scan_codebase` before reading any Rocket.Chat source file. It tells you which files are relevant and shows their structure without burning tokens on full file contents.

## Parameters

- `question` (**required**): what you want to understand, e.g. `"how are messages sent?"`
- `root` (**required**): absolute path to the Rocket.Chat repo, e.g. `/home/user/Rocket.Chat`
- `limit`: how many files to return (default: 10)
- `modules`: narrow the search to a specific area — `authorization`, `e2e`, `file-upload`, `lib-server-functions`

## Example

```
scan_codebase({
  question: "how does permission checking work?",
  root: "/home/user/Rocket.Chat",
  modules: ["authorization"]
})
```

The response includes each file's path, relevance score, skeleton code, and token counts so you can decide what to read in full.
