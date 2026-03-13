# Forecast Intelligence Skill

> **Forecast Intelligence for Agents | Professional PDF Reports with Market Consensus, D3 Visualizations & Source-Verified Analysis**

Give your agent an analyst's eye. This skill turns any AI agent into a forecast intelligence unit — producing professional, source-verified PDF reports with probability-ranked predictions, D3 visualizations, and Polymarket consensus signals.

## What It Does

One prompt in, one polished intelligence brief out. The agent autonomously:

- **Researches** the topic across 8+ source categories (breaking news, think tanks, expert analysis, historical precedent)
- **Formulates predictions** as probability-ranked outcomes with calibrated confidence levels
- **Builds visualizations** using 10 built-in D3 chart types (maps, entity graphs, timelines, sankey flows, and more)
- **Cross-references Polymarket** to surface market consensus and highlight where your assessment diverges
- **Outputs a PDF** — a single-page, CIA-brief-style intelligence assessment scannable in 30 seconds

## Works Across Domains

| Domain | Example |
|--------|---------|
| Geopolitics | Ceasefire timelines, sanctions impact, military escalation |
| Finance | Fed rate decisions, crypto market shifts, macro forecasts |
| Technology | AI model releases, product launches, regulatory actions |
| Corporate | M&A probability, IPO timing, earnings outcomes |
| Elections | Polling analysis, candidate odds, coalition scenarios |

## Quick Start

### Setup (once)

```bash
pip install playwright
playwright install chromium
```

### Try It

```
Generate a forecast report: Will the Fed cut rates before July 2026?
```

```
Forecast: What happens to EU carbon prices if the CBAM expansion passes?
```

```
Intelligence brief: Probability of a US-China semiconductor trade deal in 2026?
```

The agent reads `SKILL.md`, researches the topic, generates an HTML report with D3 visualizations, and converts it to a polished PDF.

## Why This Skill

- **Real utility** — turns hours of analyst work into a 2-minute automated workflow
- **Beautiful output** — white monochrome design with 10 D3 visualization types, all self-contained
- **Rigorous methodology** — enforces source verification, causal logic in key drivers, Bayesian calibration
- **Polymarket integration** — built-in script fetches live prediction market data and computes consensus deltas
- **Agent-agnostic** — works with any agent that can search the web, read/write files, and run shell commands
- **Zero bloat** — only dependency is Playwright for PDF conversion; everything else is self-contained HTML

## File Structure

```
forecast-intelligence/
├── SKILL.md                        # Agent instructions (complete workflow)
├── README.md                       # This file
├── reference.md                    # Data sources & methodology guide
├── templates/
│   └── report_template.html        # Self-contained HTML template with all CSS & D3
├── scripts/
│   ├── to_pdf.py                   # HTML → PDF converter (Playwright)
│   ├── fetch_polymarket.py         # Polymarket data fetcher
│   ├── build_report.py             # Legacy: JSON + Jinja2 pipeline
│   └── requirements.txt            # Python dependencies
└── examples/
    ├── example_report.html         # Filled example report
    └── sample_data.json            # Sample data (legacy pipeline)
```

## Keywords

`forecast` `prediction` `intelligence report` `PDF generation` `Polymarket` `prediction market` `D3 visualization` `geopolitics` `financial forecasting` `political analysis` `market consensus` `probability assessment` `agent skill` `research automation`

## License

[MIT](../../../LICENSE)
