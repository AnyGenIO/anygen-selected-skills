# AnyGen Selected Skills

A curated collection of high-quality AI agent skills, handpicked and maintained by the [AnyGen](https://github.com/AnyGenIO) team.

## What is this?

The AI agent ecosystem is growing fast — and so is the number of skills available on platforms like [ClawHub](https://clawdhub.com). But quantity doesn't equal quality. **AnyGen Selected Skills** is our answer to that problem: a carefully vetted set of skills we actually use, trust, and recommend.

Think of it as a "staff picks" shelf at a bookstore: every skill here has been tested in real workflows, reviewed for code quality, and proven to deliver reliable results.

## Structure

This repository follows the same layout as [openclaw/skills](https://github.com/openclaw/skills):

```
selected-skills/
└── <author>:<skill-name>/
    ├── SKILL.md          # Agent instructions (the skill itself)
    ├── README.md         # Human-readable documentation
    └── ...               # Supporting files (templates, scripts, examples)
```

Each skill lives in its own directory, namespaced by `author:skill-name`.

## Catalog

We publish our selections in a journal-style catalog. Each volume represents a batch of curated skills with editorial notes, showcases, and direct links.

**[Browse the Catalog →](CATALOG.md)**

| Volume | Date | Skills | Theme |
|--------|------|--------|-------|
| [Vol.1](CATALOG.md#vol1) | 2026-03-13 | 1 | Inaugural Edition |

## How to Use

### For AI Agents

Point your agent to the `SKILL.md` file inside any skill directory. The agent will read the instructions and execute the workflow autonomously.

### For Humans

Each skill includes a `README.md` with setup instructions, usage examples, and file structure documentation.

## Selection Criteria

A skill earns its place here by meeting **all** of the following:

- **Actually useful** — solves a real problem, not a toy demo
- **Well-structured** — clean code, clear documentation, sensible file organization
- **Agent-agnostic** — works with any capable AI agent, not locked to a specific platform
- **Tested** — we've run it ourselves and verified the output quality
- **Maintained** — actively updated or stable enough to not need updates

## Contributing

Found a great skill that deserves to be here? Open an issue with:

1. A link to the skill (ClawHub, GitHub, or direct)
2. A brief description of what it does
3. Why you think it belongs in the collection

We review submissions periodically and add selections in new catalog volumes.

## License

[MIT](LICENSE)
