# Index Protocol - DeFi Risk Scorecard

Interactive scorecard displaying real-time DeFi protocol risk assessments.

## Live Demo

**Vercel URL:** _(to be deployed)_

## Features

- Real-time TVL data from DefiLlama API
- 5-pillar risk scoring methodology
- Interactive UI with click-to-expand details
- Supports multiple protocols (Aerodrome, Velodrome, Uniswap)
- Mobile responsive
- Print-friendly

## Tech Stack

- Pure HTML/CSS/JavaScript (no framework)
- DefiLlama API (free, no key required)
- Vercel hosting

## Local Development

```bash
# Navigate to project
cd 05-Index/mvp/index-scorecard

# Start local server (Python)
python3 -m http.server 8080

# Or with Node
npx serve .

# Open browser
open http://localhost:8080
```

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Navigate to project
cd 05-Index/mvp/index-scorecard

# Deploy
vercel

# Follow prompts:
# - Set up and deploy? Yes
# - Which scope? (your account)
# - Link to existing project? No
# - Project name: index-scorecard
# - Directory: ./
# - Override settings? No

# Production deploy
vercel --prod
```

### Option 2: GitHub + Vercel Dashboard

1. Push to GitHub:
   ```bash
   cd 05-Index/mvp/index-scorecard
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create index-scorecard --public --source=. --push
   ```

2. Connect Vercel:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repo
   - Deploy (auto-detects static site)

### Custom Domain (Later)

1. In Vercel Dashboard → Project → Settings → Domains
2. Add your domain (e.g., `scorecard.theindexprotocol.com`)
3. Update DNS records:
   ```
   Type: CNAME
   Name: scorecard
   Value: cname.vercel-dns.com
   ```
   Or for apex domain:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21
   ```

## Scoring Methodology

### Weights

| Pillar | Weight |
|--------|--------|
| Smart Contract Security | 25% |
| Financial/Liquidity | 25% |
| Governance | 20% |
| Operational Security | 15% |
| Regulatory Alignment | 15% |

### Data Sources

| Data | Source |
|------|--------|
| TVL, Volume | DefiLlama API |
| Token holders | Ormilabs API (planned) |
| Governance | Snapshot API (planned) |
| Audits, Incidents | Manual curation |

## Adding New Protocols

Edit `app.js` and add to the `PROTOCOLS` object:

```javascript
'new-protocol': {
    name: 'New Protocol',
    slug: 'new-protocol', // DefiLlama slug
    chain: 'Ethereum',
    category: 'DEX',
    launchDate: '2024-01-01',
    manualData: {
        audits: ['Auditor1', 'Auditor2'],
        // ... other fields
    }
}
```

## File Structure

```
index-scorecard/
├── index.html      # Main HTML page
├── style.css       # Styling
├── app.js          # Data fetching, scoring, rendering
├── vercel.json     # Vercel config
└── README.md       # This file
```

## Future Improvements

- [ ] Ormilabs integration for token holder data
- [ ] Snapshot API for governance metrics
- [ ] Historical score tracking
- [ ] Protocol comparison view
- [ ] Embeddable widget for partners

---

**Index Protocol** - DeFi Risk Intelligence
