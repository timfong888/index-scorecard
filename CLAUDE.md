# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DeFi risk scorecard displaying real-time protocol assessments using a 5-pillar methodology. Built with vanilla HTML/CSS/JavaScript (no framework).

**Live Demo**: Vercel deployment (see vercel.json)

## Development Commands

```bash
# Local development (Python)
python3 -m http.server 8080

# Local development (Node)
npx serve .

# Deploy to Vercel
vercel --prod
```

## Project Structure

```
score-app/
├── index.html      # Main page with scorecard layout
├── style.css       # Dark theme, CSS variables, responsive
├── app.js          # Data fetching, scoring engine, rendering
├── vercel.json     # Vercel hosting config
└── Score Definition.md  # Methodology spec (reference only)
```

## Architecture

**Data Flow**: Protocol selector → DefiLlama API → Scoring Engine → UI Render

### Data Sources

| Data | Source | Endpoint |
|------|--------|----------|
| TVL, volume, trends | DefiLlama | `api.llama.fi/protocol/{slug}` |
| Chain TVL | DefiLlama | `api.llama.fi/v2/chains` |
| Token holders, governance | Manual (future: Ormilabs) | Hardcoded in `PROTOCOLS` |

### Scoring Engine (app.js)

5-pillar weighted scoring:

| Pillar | Weight | Key Inputs |
|--------|--------|------------|
| Smart Contract | 25% | audits, daysLive, vulns, openSource, bugBounty |
| Liquidity | 25% | TVL (log scale), chain dominance, 24h trend |
| Governance | 20% | top10 concentration, activeVoters, proposalActivity |
| Operational | 15% | multisig, timelockHours, incidents, upgradePattern |
| Regulatory | 15% | institutionalBacking, complianceDocs, jurisdiction |

Each pillar returns `{ score: 0-100, details: {...} }`.

### Adding Protocols

Edit the `PROTOCOLS` object in `app.js`:

```javascript
'protocol-slug': {
    name: 'Protocol Name',
    slug: 'defillama-slug',  // Must match DefiLlama
    chain: 'Base',
    category: 'DEX',
    launchDate: '2023-08-28',
    manualData: {
        audits: ['Auditor1', 'Auditor2'],
        criticalVulns: 0,
        // ... see existing protocols for full schema
    }
}
```

## Design System

**Colors** (CSS variables in `:root`):
- Backgrounds: `--color-bg` (#0a0a0f), `--color-surface` (#12121a)
- Score ratings: `--color-score-excellent` (green), `--color-score-good`, `--color-score-moderate` (yellow), `--color-score-poor` (red)

**Score Ratings**:
- Excellent: 85+
- Good: 70-84
- Moderate: 50-69
- Poor: <50

## Key Functions

| Function | Purpose |
|----------|---------|
| `loadProtocol(slug)` | Main entry - fetches data, calculates scores, renders |
| `calculateAllScores()` | Orchestrates all pillar calculations |
| `generateFindings()` | Produces strengths/risks lists from scores |
| `renderScorecard()` | Updates DOM with calculated data |

## Related Files

- `../MVP-Architecture-Ormilabs.md` - Full architecture spec with API details
- `../research/DeFi-Protocol-Health-Metrics-Comprehensive-Research.md` - Research foundation
