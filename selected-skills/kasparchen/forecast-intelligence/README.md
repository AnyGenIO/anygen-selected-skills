# Forecast Intelligence Skill

Generate professional CIA-brief-style forecast reports as PDF.
Primary domain: geopolitics. Adapts to finance, tech, corporate, or any domain.

## Quick Start

### Setup (once)
```bash
pip install playwright
playwright install chromium
```

### Usage

**For AI agents**: Read `SKILL.md` for the complete workflow. The agent:
1. Reads `templates/report_template.html` (the structural reference)
2. Researches the topic
3. Generates a new `.html` following the template's exact structure
4. Converts to PDF: `python scripts/to_pdf.py report.html output.pdf`

**For humans**: Open `templates/report_template.html` in a browser to see the
layout. Copy it, replace content, run `python scripts/to_pdf.py`.

## File Structure

```
skill/
├── SKILL.md                           # Agent instructions (complete workflow)
├── README.md                          # This file
├── reference.md                       # Data sources & methodology guide
├── templates/
│   ├── report_template.html           # ★ THE template — self-contained, annotated
│   └── report.html                    # Jinja2 template (legacy, for build_report.py)
├── scripts/
│   ├── to_pdf.py                      # HTML → PDF converter (only needs playwright)
│   ├── build_report.py                # Legacy: JSON + Jinja2 → PDF pipeline
│   ├── fetch_polymarket.py            # Polymarket data fetcher
│   └── requirements.txt              # Python dependencies
└── examples/
    ├── example_report.html            # Filled example (rendered from sample data)
    └── sample_data.json               # Sample data (for legacy pipeline)
```

## Key Design

- **Self-contained template**: All CSS and D3 visualization code is embedded
  in `report_template.html`. Agents copy the file and replace content.
- **No build pipeline required**: The agent generates HTML directly.
  No Jinja2, no JSON intermediate files, no Python template rendering.
- **Only dependency**: Playwright (for HTML → PDF). D3.js and fonts load from CDN.
- **Agent-agnostic**: Works with any AI agent that can read files, search the web,
  write files, and run shell commands.
