/**
 * Index Protocol - DeFi Risk Scorecard
 * Fetches real data from DefiLlama and calculates risk scores
 */

// ============================================
// PROTOCOL CONFIGURATIONS
// ============================================

const PROTOCOLS = {
    'aerodrome-finance': {
        name: 'Aerodrome Finance',
        slug: 'aerodrome-slipstream',
        chain: 'Base',
        category: 'DEX',
        launchDate: '2023-08-28',
        // Manual data (would come from Ormilabs or other APIs in production)
        manualData: {
            audits: ['Quantstamp', 'OpenZeppelin', 'PeckShield'],
            criticalVulns: 0,
            openSource: true,
            bugBounty: true,
            governanceModel: 'veAERO',
            topHoldersPct: 45,
            activeVoters: 4200,
            proposalActivity: 'High',
            hasMultisig: true,
            multisigSigners: '3/5',
            timelockHours: 0,
            incidentCount: 2,
            incidentDetails: 'Front-end DNS compromises',
            upgradePattern: 'Proxy upgradeable',
            institutionalBacking: ['Coinbase Ventures'],
            complianceDocs: true,
            jurisdiction: 'Global (Base/Coinbase aligned)',
            teamTransparency: 'Public (Alex Cutler)'
        }
    },
    'velodrome-finance': {
        name: 'Velodrome Finance',
        slug: 'velodrome-v2',
        chain: 'Optimism',
        category: 'DEX',
        launchDate: '2022-06-01',
        manualData: {
            audits: ['Code4rena', 'PeckShield'],
            criticalVulns: 0,
            openSource: true,
            bugBounty: true,
            governanceModel: 'veVELO',
            topHoldersPct: 38,
            activeVoters: 3500,
            proposalActivity: 'High',
            hasMultisig: true,
            multisigSigners: '4/7',
            timelockHours: 24,
            incidentCount: 0,
            incidentDetails: 'None',
            upgradePattern: 'Immutable core',
            institutionalBacking: ['Optimism Foundation'],
            complianceDocs: true,
            jurisdiction: 'Global',
            teamTransparency: 'Pseudonymous'
        }
    },
    'uniswap': {
        name: 'Uniswap',
        slug: 'uniswap-v3',
        chain: 'Ethereum',
        category: 'DEX',
        launchDate: '2018-11-02',
        manualData: {
            audits: ['Trail of Bits', 'ABDK', 'OpenZeppelin', 'Consensys Diligence'],
            criticalVulns: 0,
            openSource: true,
            bugBounty: true,
            governanceModel: 'UNI Token',
            topHoldersPct: 52,
            activeVoters: 8500,
            proposalActivity: 'Medium',
            hasMultisig: true,
            multisigSigners: '4/6',
            timelockHours: 48,
            incidentCount: 0,
            incidentDetails: 'None',
            upgradePattern: 'Immutable (V3)',
            institutionalBacking: ['a16z', 'Paradigm', 'USV'],
            complianceDocs: true,
            jurisdiction: 'USA (Uniswap Labs)',
            teamTransparency: 'Public'
        }
    }
};

// ============================================
// DATA FETCHING
// ============================================

async function fetchDefiLlamaData(protocolSlug) {
    const response = await fetch(`https://api.llama.fi/protocol/${protocolSlug}`);
    if (!response.ok) throw new Error('Failed to fetch DefiLlama data');
    return response.json();
}

async function fetchChainTVL(chain) {
    const response = await fetch('https://api.llama.fi/v2/chains');
    if (!response.ok) throw new Error('Failed to fetch chain data');
    const chains = await response.json();
    const chainData = chains.find(c => c.name.toLowerCase() === chain.toLowerCase());
    return chainData ? chainData.tvl : 0;
}

async function fetchYieldData(protocolSlug) {
    try {
        const response = await fetch('https://yields.llama.fi/pools');
        if (!response.ok) return null;
        const data = await response.json();

        // Filter pools for this protocol
        const protocolPools = data.data.filter(pool =>
            pool.project && pool.project.toLowerCase().includes(protocolSlug.toLowerCase().replace('-', ''))
        );

        if (protocolPools.length === 0) return null;

        // Calculate average APY and other yield metrics
        const avgApy = protocolPools.reduce((sum, p) => sum + (p.apy || 0), 0) / protocolPools.length;
        const maxApy = Math.max(...protocolPools.map(p => p.apy || 0));
        const totalTvlUsd = protocolPools.reduce((sum, p) => sum + (p.tvlUsd || 0), 0);

        // Check yield stability (variance over 7 days if available)
        const apyChanges = protocolPools.map(p => p.apyPct7D || 0);
        const avgChange = apyChanges.reduce((sum, c) => sum + Math.abs(c), 0) / apyChanges.length;

        return {
            avgApy,
            maxApy,
            totalTvlUsd,
            poolCount: protocolPools.length,
            apyStability: avgChange, // Lower is more stable
            pools: protocolPools.slice(0, 5) // Top 5 pools
        };
    } catch (error) {
        console.warn('Could not fetch yield data:', error);
        return null;
    }
}

// ============================================
// SCORING ENGINE
// ============================================

const WEIGHTS = {
    smartContract: 0.25,
    liquidity: 0.25,
    governance: 0.20,
    operational: 0.15,
    regulatory: 0.15
};

function calculateSmartContractScore(protocolConfig, defiLlamaData) {
    const manual = protocolConfig.manualData;
    const launchDate = new Date(protocolConfig.launchDate);
    const daysLive = Math.floor((Date.now() - launchDate) / (1000 * 60 * 60 * 24));

    // Scoring components (0-100 each)
    const auditScore = Math.min(100, manual.audits.length * 25); // Max 100 for 4+ audits
    const ageScore = Math.min(100, (daysLive / 730) * 100); // Max 100 for 2+ years
    const vulnScore = manual.criticalVulns === 0 ? 100 : Math.max(0, 100 - manual.criticalVulns * 30);
    const openSourceScore = manual.openSource ? 100 : 0;
    const bountyScore = manual.bugBounty ? 100 : 0;

    // Weighted average
    const score = (auditScore * 0.30) + (ageScore * 0.20) + (vulnScore * 0.25) +
                  (openSourceScore * 0.15) + (bountyScore * 0.10);

    return {
        score: Math.round(score),
        details: {
            audits: manual.audits.join(', '),
            mainnetTime: `${daysLive} days`,
            vulns: manual.criticalVulns === 0 ? 'None' : `${manual.criticalVulns} critical`,
            openSource: manual.openSource ? 'Yes' : 'No',
            bounty: manual.bugBounty ? 'Active' : 'None'
        }
    };
}

function calculateLiquidityScore(protocolConfig, defiLlamaData, chainTVL) {
    // Get TVL from currentChainTvls (sum all chains or get specific chain)
    const chainTvls = defiLlamaData.currentChainTvls || {};
    const tvl = Object.values(chainTvls).reduce((sum, val) => sum + (val || 0), 0);
    const protocolChainTvl = chainTvls[protocolConfig.chain] || tvl;

    // TVL score (log scale)
    const tvlScore = Math.min(100, Math.log10(tvl / 1000000 + 1) * 33); // Scaled for $1B = ~100

    // Chain dominance
    const dominance = chainTVL > 0 ? (protocolChainTvl / chainTVL) * 100 : 0;
    const dominanceScore = Math.min(100, dominance * 3); // 33% dominance = 100

    // Volume/TVL efficiency (for DEXes, higher is better)
    const change24h = defiLlamaData.change_1d ?? 0;
    const trendScore = change24h > 0 ? Math.min(100, 70 + change24h) : Math.max(0, 70 + change24h);

    const score = (tvlScore * 0.40) + (dominanceScore * 0.35) + (trendScore * 0.25);

    // Safe formatting
    const efficiencyPct = tvl > 0 ? ((protocolChainTvl / tvl) * 100).toFixed(1) : '0.0';
    const trendStr = change24h !== null ? (change24h >= 0 ? `+${change24h.toFixed(1)}%` : `${change24h.toFixed(1)}%`) : 'N/A';

    return {
        score: Math.round(score),
        details: {
            tvl: formatCurrency(tvl),
            tvlRank: dominance > 30 ? '#1 on chain' : dominance > 10 ? 'Top 5' : 'Top 20',
            efficiency: efficiencyPct + '% of protocol',
            trend: trendStr
        }
    };
}

function calculateGovernanceScore(protocolConfig) {
    const manual = protocolConfig.manualData;

    // Token concentration (lower is better)
    const concentrationScore = Math.max(0, 100 - manual.topHoldersPct);

    // Voter participation
    const voterScore = Math.min(100, (manual.activeVoters / 5000) * 100);

    // Governance model
    const modelScore = manual.governanceModel.includes('ve') ? 85 : 70;

    // Activity
    const activityScore = manual.proposalActivity === 'High' ? 90 :
                          manual.proposalActivity === 'Medium' ? 70 : 50;

    const score = (concentrationScore * 0.35) + (voterScore * 0.25) +
                  (modelScore * 0.20) + (activityScore * 0.20);

    return {
        score: Math.round(score),
        details: {
            concentration: `${manual.topHoldersPct}%`,
            govModel: manual.governanceModel,
            voters: formatNumber(manual.activeVoters),
            proposals: manual.proposalActivity
        }
    };
}

function calculateOperationalScore(protocolConfig) {
    const manual = protocolConfig.manualData;

    // Multisig
    const multisigScore = manual.hasMultisig ? 80 : 20;

    // Timelock
    const timelockScore = manual.timelockHours >= 48 ? 100 :
                          manual.timelockHours >= 24 ? 80 :
                          manual.timelockHours > 0 ? 60 : 30;

    // Incident history
    const incidentScore = manual.incidentCount === 0 ? 100 :
                          Math.max(0, 100 - manual.incidentCount * 25);

    // Upgrade pattern
    const upgradeScore = manual.upgradePattern.includes('Immutable') ? 90 : 60;

    const score = (multisigScore * 0.25) + (timelockScore * 0.25) +
                  (incidentScore * 0.30) + (upgradeScore * 0.20);

    return {
        score: Math.round(score),
        details: {
            multisig: manual.hasMultisig ? manual.multisigSigners : 'None',
            timelock: manual.timelockHours > 0 ? `${manual.timelockHours}h delay` : 'No delay',
            incidents: manual.incidentCount === 0 ? 'None' : `${manual.incidentCount} (${manual.incidentDetails})`,
            upgrades: manual.upgradePattern
        }
    };
}

function calculateRegulatoryScore(protocolConfig) {
    const manual = protocolConfig.manualData;

    // Institutional backing
    const backingScore = manual.institutionalBacking.length > 0 ?
                         Math.min(100, 50 + manual.institutionalBacking.length * 20) : 30;

    // Compliance docs
    const complianceScore = manual.complianceDocs ? 80 : 40;

    // Jurisdiction risk (simplified)
    const jurisdictionScore = manual.jurisdiction.includes('USA') ? 70 :
                              manual.jurisdiction.includes('Global') ? 75 : 60;

    // Team transparency
    const teamScore = manual.teamTransparency === 'Public' ? 90 :
                      manual.teamTransparency.includes('Public') ? 85 : 50;

    const score = (backingScore * 0.30) + (complianceScore * 0.25) +
                  (jurisdictionScore * 0.25) + (teamScore * 0.20);

    return {
        score: Math.round(score),
        details: {
            backing: manual.institutionalBacking.join(', ') || 'None',
            compliance: manual.complianceDocs ? 'Available' : 'Limited',
            jurisdiction: manual.jurisdiction,
            team: manual.teamTransparency
        }
    };
}

function calculateAllScores(protocolConfig, defiLlamaData, chainTVL) {
    const smartContract = calculateSmartContractScore(protocolConfig, defiLlamaData);
    const liquidity = calculateLiquidityScore(protocolConfig, defiLlamaData, chainTVL);
    const governance = calculateGovernanceScore(protocolConfig);
    const operational = calculateOperationalScore(protocolConfig);
    const regulatory = calculateRegulatoryScore(protocolConfig);

    const indexScore = Math.round(
        smartContract.score * WEIGHTS.smartContract +
        liquidity.score * WEIGHTS.liquidity +
        governance.score * WEIGHTS.governance +
        operational.score * WEIGHTS.operational +
        regulatory.score * WEIGHTS.regulatory
    );

    return {
        indexScore,
        pillars: { smartContract, liquidity, governance, operational, regulatory },
        defiLlamaData
    };
}

// ============================================
// TRILEMMA SCORING
// ============================================

function calculateYieldScore(yieldData, defiLlamaData) {
    // If no yield data available, estimate from protocol characteristics
    if (!yieldData) {
        // Fallback: estimate based on fees and TVL growth
        const feeScore = defiLlamaData.fees30d ? Math.min(100, (defiLlamaData.fees30d / 1000000) * 20) : 50;
        const change7d = defiLlamaData.change_7d || 0;
        const growthScore = change7d > 0 ? Math.min(100, 60 + change7d * 2) : Math.max(0, 60 + change7d * 2);
        return Math.round((feeScore * 0.6) + (growthScore * 0.4));
    }

    // Base APY score (higher APY = higher score, capped at 100%)
    const apyScore = Math.min(100, yieldData.avgApy * 2); // 50% APY = 100 score

    // Stability score (less variance = higher score)
    const stabilityScore = Math.max(0, 100 - yieldData.apyStability * 5);

    // Sustainability (TVL in yield pools vs total TVL)
    const sustainabilityScore = yieldData.poolCount > 10 ? 80 : yieldData.poolCount > 5 ? 70 : 60;

    return Math.round((apyScore * 0.50) + (stabilityScore * 0.30) + (sustainabilityScore * 0.20));
}

function calculateTrilemmaScores(pillars, yieldData, defiLlamaData) {
    // YIELD: Return on capital
    const yieldScore = calculateYieldScore(yieldData, defiLlamaData);

    // SAFETY: Protection from loss (smart contract + governance + operational)
    // Smart Contract (50%) + Governance (25%) + Operational (25%)
    const safetyScore = Math.round(
        (pillars.smartContract.score * 0.50) +
        (pillars.governance.score * 0.25) +
        (pillars.operational.score * 0.25)
    );

    // LIQUIDITY: Ability to exit position (liquidity pillar + operational)
    // Liquidity (70%) + Operational (30% - for exit mechanisms)
    const liquidityScore = Math.round(
        (pillars.liquidity.score * 0.70) +
        (pillars.operational.score * 0.30)
    );

    // Central trilemma score (balanced average)
    const centralScore = Math.round((yieldScore + safetyScore + liquidityScore) / 3);

    return {
        yield: yieldScore,
        safety: safetyScore,
        liquidity: liquidityScore,
        central: centralScore,
        // Contribution mapping for UI
        contributions: {
            yield: ['fees', 'growth', 'apy'],
            safety: ['smartContract', 'governance', 'operational'],
            liquidity: ['liquidity', 'operational']
        }
    };
}

// ============================================
// FINDINGS GENERATOR
// ============================================

function generateFindings(scores, protocolConfig) {
    const strengths = [];
    const risks = [];
    const manual = protocolConfig.manualData;

    // Smart Contract
    if (scores.pillars.smartContract.score >= 75) {
        strengths.push(`${manual.audits.length} security audits completed`);
    }
    if (manual.criticalVulns > 0) {
        risks.push(`${manual.criticalVulns} critical vulnerabilities in history`);
    }

    // Liquidity
    if (scores.pillars.liquidity.score >= 80) {
        strengths.push('Strong TVL and liquidity depth');
    }
    if (scores.defiLlamaData.change_1d !== null && scores.defiLlamaData.change_1d < -5) {
        risks.push(`TVL declining (${scores.defiLlamaData.change_1d.toFixed(1)}% 24h)`);
    }

    // Governance
    if (manual.topHoldersPct > 40) {
        risks.push(`High token concentration (top 10 = ${manual.topHoldersPct}%)`);
    }
    if (manual.activeVoters > 3000) {
        strengths.push('Active governance participation');
    }

    // Operational
    if (manual.hasMultisig) {
        strengths.push(`Multisig protection (${manual.multisigSigners})`);
    }
    if (manual.timelockHours === 0) {
        risks.push('No timelock on contract upgrades');
    }
    if (manual.incidentCount > 0) {
        risks.push(`${manual.incidentCount} security incidents in history`);
    }

    // Regulatory
    if (manual.institutionalBacking.length > 0) {
        strengths.push(`Institutional backing: ${manual.institutionalBacking.join(', ')}`);
    }
    if (manual.teamTransparency === 'Pseudonymous') {
        risks.push('Team operates pseudonymously');
    }

    return { strengths, risks };
}

// ============================================
// UI RENDERING
// ============================================

function getScoreRating(score) {
    if (score >= 85) return { label: 'Excellent', class: 'excellent' };
    if (score >= 70) return { label: 'Good', class: 'good' };
    if (score >= 50) return { label: 'Moderate', class: 'moderate' };
    return { label: 'Poor', class: 'poor' };
}

function formatCurrency(value) {
    const num = Number(value) || 0;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
    return `$${num.toFixed(0)}`;
}

function formatNumber(value) {
    const num = Number(value) || 0;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toString();
}

function renderScorecard(scores, protocolConfig, trilemmaScores, defiLlamaData) {
    const launchDate = new Date(protocolConfig.launchDate);
    const daysLive = Math.floor((Date.now() - launchDate) / (1000 * 60 * 60 * 24));
    const rating = getScoreRating(scores.indexScore);
    const findings = generateFindings(scores, protocolConfig);

    // Protocol info
    document.getElementById('protocol-name').textContent = protocolConfig.name;
    document.getElementById('protocol-chain').textContent = protocolConfig.chain;
    document.getElementById('protocol-category').textContent = protocolConfig.category;
    document.getElementById('last-updated').textContent = `Updated: ${new Date().toLocaleString()}`;

    // Score rating
    const ratingEl = document.getElementById('score-rating');
    ratingEl.textContent = rating.label;
    ratingEl.className = `score-rating ${rating.class}`;

    // Score change (using 7d TVL change as proxy for score momentum)
    const change7d = defiLlamaData.change_7d || 0;
    const changeEl = document.getElementById('change-value');
    if (change7d !== null && change7d !== undefined) {
        const changeStr = change7d >= 0 ? `+${change7d.toFixed(1)}%` : `${change7d.toFixed(1)}%`;
        changeEl.textContent = changeStr;
        changeEl.className = `change-value ${change7d > 0 ? 'positive' : change7d < 0 ? 'negative' : 'neutral'}`;
    } else {
        changeEl.textContent = '--';
        changeEl.className = 'change-value neutral';
    }

    // Metrics bar
    const totalTvl = Object.values(scores.defiLlamaData.currentChainTvls || {}).reduce((sum, v) => sum + (v || 0), 0);
    document.getElementById('metric-tvl').textContent = formatCurrency(totalTvl);
    const change1d = scores.defiLlamaData.change_1d;
    document.getElementById('metric-volume').textContent = (change1d !== null && change1d !== undefined) ?
        `${change1d >= 0 ? '+' : ''}${change1d.toFixed(1)}%` : 'N/A';
    document.getElementById('metric-dominance').textContent = scores.pillars.liquidity.details.tvlRank;
    document.getElementById('metric-age').textContent = daysLive;

    // Pillar scores
    const pillarMap = {
        smartContract: { score: 'score-smartContract', bar: 'bar-smartContract', details: 'details-smartContract' },
        liquidity: { score: 'score-liquidity', bar: 'bar-liquidity', details: 'details-liquidity' },
        governance: { score: 'score-governance', bar: 'bar-governance', details: 'details-governance' },
        operational: { score: 'score-operational', bar: 'bar-operational', details: 'details-operational' },
        regulatory: { score: 'score-regulatory', bar: 'bar-regulatory', details: 'details-regulatory' }
    };

    Object.entries(pillarMap).forEach(([key, ids]) => {
        const pillarData = scores.pillars[key];
        const pillarRating = getScoreRating(pillarData.score);

        document.getElementById(ids.score).textContent = pillarData.score;

        const barEl = document.getElementById(ids.bar);
        barEl.style.width = `${pillarData.score}%`;
        barEl.className = `pillar-bar-fill ${pillarRating.class}`;
    });

    // Smart Contract details
    document.getElementById('detail-audits').textContent = scores.pillars.smartContract.details.audits;
    document.getElementById('detail-mainnet-time').textContent = scores.pillars.smartContract.details.mainnetTime;
    document.getElementById('detail-vulns').textContent = scores.pillars.smartContract.details.vulns;
    document.getElementById('detail-opensource').textContent = scores.pillars.smartContract.details.openSource;
    document.getElementById('detail-bounty').textContent = scores.pillars.smartContract.details.bounty;

    // Liquidity details
    document.getElementById('detail-tvl').textContent = scores.pillars.liquidity.details.tvl;
    document.getElementById('detail-tvl-rank').textContent = scores.pillars.liquidity.details.tvlRank;
    document.getElementById('detail-efficiency').textContent = scores.pillars.liquidity.details.efficiency;
    document.getElementById('detail-trend').textContent = scores.pillars.liquidity.details.trend;

    // Governance details
    document.getElementById('detail-concentration').textContent = scores.pillars.governance.details.concentration;
    document.getElementById('detail-gov-model').textContent = scores.pillars.governance.details.govModel;
    document.getElementById('detail-voters').textContent = scores.pillars.governance.details.voters;
    document.getElementById('detail-proposals').textContent = scores.pillars.governance.details.proposals;

    // Operational details
    document.getElementById('detail-multisig').textContent = scores.pillars.operational.details.multisig;
    document.getElementById('detail-timelock').textContent = scores.pillars.operational.details.timelock;
    document.getElementById('detail-incidents').textContent = scores.pillars.operational.details.incidents;
    document.getElementById('detail-upgrades').textContent = scores.pillars.operational.details.upgrades;

    // Regulatory details
    document.getElementById('detail-backing').textContent = scores.pillars.regulatory.details.backing;
    document.getElementById('detail-compliance').textContent = scores.pillars.regulatory.details.compliance;
    document.getElementById('detail-jurisdiction').textContent = scores.pillars.regulatory.details.jurisdiction;
    document.getElementById('detail-team').textContent = scores.pillars.regulatory.details.team;

    // Findings
    const strengthsList = document.getElementById('strengths-list');
    const risksList = document.getElementById('risks-list');

    strengthsList.innerHTML = findings.strengths.map(s => `<li>${s}</li>`).join('');
    risksList.innerHTML = findings.risks.map(r => `<li>${r}</li>`).join('');
}

function renderTrilemma(trilemmaScores) {
    // Update central score
    document.getElementById('trilemma-central-score').textContent = trilemmaScores.central;

    // Update vertex scores
    document.getElementById('trilemma-yield-score').textContent = trilemmaScores.yield;
    document.getElementById('trilemma-safety-score').textContent = trilemmaScores.safety;
    document.getElementById('trilemma-liquidity-score').textContent = trilemmaScores.liquidity;
}

// ============================================
// MAIN APPLICATION
// ============================================

async function loadProtocol(protocolSlug = null) {
    const slug = protocolSlug || document.getElementById('protocol-select').value;
    const protocolConfig = PROTOCOLS[slug];

    if (!protocolConfig) {
        showError('Protocol not found');
        return;
    }

    // Show loading
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('scorecard').classList.add('hidden');
    document.getElementById('error').classList.add('hidden');

    try {
        // Fetch data (yield data is optional, so we catch errors separately)
        const [defiLlamaData, chainTVL, yieldData] = await Promise.all([
            fetchDefiLlamaData(protocolConfig.slug),
            fetchChainTVL(protocolConfig.chain),
            fetchYieldData(protocolConfig.slug)
        ]);

        // Calculate pillar scores
        const scores = calculateAllScores(protocolConfig, defiLlamaData, chainTVL);

        // Calculate trilemma scores
        const trilemmaScores = calculateTrilemmaScores(scores.pillars, yieldData, defiLlamaData);

        // Use trilemma central score as the main INDEX SCORE
        scores.indexScore = trilemmaScores.central;

        // Render UI
        renderScorecard(scores, protocolConfig, trilemmaScores, defiLlamaData);
        renderTrilemma(trilemmaScores);

        // Show scorecard
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('scorecard').classList.remove('hidden');

    } catch (error) {
        console.error('Error loading protocol:', error);
        showError(error.message);
    }
}

function showError(message) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('scorecard').classList.add('hidden');
    document.getElementById('error').classList.remove('hidden');
    document.getElementById('error-message').textContent = message;
}

// ============================================
// EVENT LISTENERS
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Load default protocol
    loadProtocol();

    // Protocol selector
    document.getElementById('protocol-select').addEventListener('change', () => loadProtocol());
    document.getElementById('refresh-btn').addEventListener('click', () => loadProtocol());

    // Pillar click to expand
    document.querySelectorAll('.pillar').forEach(pillar => {
        pillar.addEventListener('click', () => {
            const pillarName = pillar.dataset.pillar;
            const detailsEl = document.getElementById(`details-${pillarName}`);

            // Toggle this pillar's details
            detailsEl.classList.toggle('hidden');

            // Collapse others
            document.querySelectorAll('.pillar-details').forEach(el => {
                if (el.id !== `details-${pillarName}`) {
                    el.classList.add('hidden');
                }
            });
        });
    });
});

// Export for testing
if (typeof module !== 'undefined') {
    module.exports = { calculateAllScores, PROTOCOLS };
}
