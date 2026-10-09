// Static reference data: topics, worlds, ranks, demo level.

// Level I topic weights (CFA Institute ranges, unchanged 2024–2027).
// `hours` = typical study hours for a first pass (CFA Institute suggests ~300+ total).
export const TOPICS = [
  { id: 'quant',  name: 'Quantitative Methods', short: 'Quant',        lens: 'tools',      color: '#8FC1AE', icon: '∑', weight: [6, 9],   hours: 32,
    blurb: 'The measuring tools: returns, time value of money, statistics, hypothesis tests, regression.' },
  { id: 'econ',   name: 'Economics',            short: 'Econ',         lens: 'tools',      color: '#A9C7E8', icon: '⚖', weight: [6, 9],   hours: 28,
    blurb: 'The environment the company lives in: markets, cycles, policy, trade, currencies.' },
  { id: 'corp',   name: 'Corporate Issuers',    short: 'Corp Issuers', lens: 'company',    color: '#C29979', icon: '🏛', weight: [6, 9],   hours: 22,
    blurb: 'How the company is owned, governed, and funded — and how it decides what to invest in.' },
  { id: 'fsa',    name: 'Financial Statement Analysis', short: 'FSA',  lens: 'company',    color: '#E3BE98', icon: '📊', weight: [11, 14], hours: 55,
    blurb: 'How the company reports what happened — and how analysts read between the lines.' },
  { id: 'equity', name: 'Equity Investments',   short: 'Equity',       lens: 'securities', color: '#CCF5AC', icon: '📈', weight: [11, 14], hours: 40,
    blurb: 'Markets for ownership claims, industry analysis, and valuing the company\'s shares.' },
  { id: 'fi',     name: 'Fixed Income',         short: 'Fixed Income', lens: 'securities', color: '#7FD6B0', icon: '🧾', weight: [11, 14], hours: 50,
    blurb: 'The company\'s debt from the lender\'s side: pricing, yields, duration, credit, securitization.' },
  { id: 'deriv',  name: 'Derivatives',          short: 'Derivatives',  lens: 'toolkit',    color: '#E8836A', icon: '⚡', weight: [5, 8],   hours: 24,
    blurb: 'Forwards, futures, swaps, and options — contracts for transferring risk.' },
  { id: 'alt',    name: 'Alternative Investments', short: 'Alternatives', lens: 'toolkit', color: '#B9A7DA', icon: '🗝', weight: [7, 10],  hours: 20,
    blurb: 'Private capital, real estate, infrastructure, natural resources, hedge funds, digital assets.' },
  { id: 'pm',     name: 'Portfolio Management', short: 'Portfolio Mgmt', lens: 'toolkit',  color: '#F2A07B', icon: '🎯', weight: [8, 12],  hours: 26,
    blurb: 'Combining everything: risk and return, the investor\'s needs, behavioral biases, risk management.' },
  { id: 'ethics', name: 'Ethical & Professional Standards', short: 'Ethics', lens: 'rules', color: '#F4EDE4', icon: '🛡', weight: [15, 20], hours: 38,
    blurb: 'The Code and Standards — the rules every other topic is played under. Highest weight.' },
];

// 2027 Level I learning modules (102), per a prep-provider outline of the 2027 curriculum.
// Check against the official list on the CFA Institute portal; rename in the app if they differ.
export const MODULES = {
  quant: ['Returns of Financial Assets and Instruments', 'Types of Financial Returns', 'Benchmarking Returns', 'The Time Value of Money in Finance', 'Statistical Characteristics of Asset Returns', 'Statistical Distributions for Financial Asset Prices and Returns', 'Estimation and Hypothesis Testing', 'The Return and Risk of a Financial Portfolio', 'Simulation of Financial Asset Prices and Returns', 'Applications of Simple Linear Regression in Finance', 'Introduction to Financial Data Science'],
  econ: ['The Firm and Market Structures', 'Understanding Business Cycles', 'Fiscal Policy', 'Monetary Policy', 'Introduction to Geopolitics', 'International Trade', 'Capital Flows and the FX Market', 'Exchange Rate Calculations'],
  corp: ['Organizational Forms, Corporate Issuer Features, and Ownership', 'Investors and Other Stakeholders', 'Corporate Governance: Conflicts, Mechanisms, Risks, and Benefits', 'Working Capital and Liquidity', 'Capital Investments and Capital Allocation', 'Capital Structure', 'Business Models'],
  fsa: ['Introduction to Financial Statement Analysis', 'Analyzing Income Statements', 'Analyzing Balance Sheets', 'Analyzing Statements of Cash Flows I', 'Analyzing Statements of Cash Flows II', 'Analysis of Inventories', 'Analysis of Long-Term Assets', 'Topics in Long-Term Liabilities and Equity', 'Analysis of Income Taxes', 'Financial Reporting Quality', 'Financial Analysis Techniques', 'Introduction to Financial Statement Modeling'],
  equity: ['Equity Instrument Features', 'Equity Jurisdictions, Classes, and the Voting Process', 'Equity Issuance and Trading', 'Sources of Equity Returns', 'Introduction to Equity Valuation', 'Discounted Cash Flow (DCF) and Growth Models', 'Relative Value Equity Valuation Approaches', 'Financial Statement Forecasting in Equity Valuation', 'Industry and Competitive Analysis', 'Company Analysis: Past, Present, and Future', 'Equity Analyst Research Reports', 'The Capital Asset Pricing Model, Market Model, and Other Factor-Based Equity Models'],
  fi: ['Fixed-Income Instrument Features', 'Fixed-Income Cash Flows and Types', 'Fixed-Income Issuance and Trading', 'Fixed-Income Markets for Corporate Issuers', 'Fixed-Income Markets for Government Issuers', 'Fixed-Income Bond Valuation: Prices and Yields', 'Yield and Yield Spread Measures for Fixed-Rate Bonds', 'Yield and Yield Spread Measures for Floating-Rate Instruments', 'The Term Structure of Interest Rates: Spot, Par, and Forward Curves', 'Interest Rate Risk and Return', 'Yield-Based Bond Duration Measures and Properties', 'Yield-Based Bond Convexity and Portfolio Properties', 'Curve-Based and Empirical Fixed-Income Risk Measures', 'Credit Risk', 'Credit Analysis for Government Issuers', 'Credit Analysis for Corporate Issuers', 'Fixed-Income Securitization', 'Asset-Backed Security (ABS) Instrument and Market Features', 'Mortgage-Backed Security (MBS) Instrument and Market Features'],
  deriv: ['Derivative Instrument and Derivative Market Features', 'Forward Commitment and Contingent Claim Features and Instruments', 'Derivative Benefits, Risks, and Issuer and Investor Uses', 'Arbitrage, Replication, and the Cost of Carry in Pricing Derivatives', 'Pricing and Valuation of Forward Contracts and for an Underlying with Varying Maturities', 'Pricing and Valuation of Futures Contracts', 'Pricing and Valuation of Interest Rate and Other Swaps', 'Pricing and Valuation of Options', 'Option Replication Using Put–Call Parity', 'Valuing a Derivative Using a One-Period Binomial Model'],
  alt: ['Alternative Investment Features, Methods, and Structures', 'Alternative Investment Performance and Returns', 'Investments in Private Capital: Equity and Debt', 'Real Estate and Infrastructure', 'Natural Resources', 'Hedge Funds', 'Introduction to Digital Assets'],
  pm: ['Portfolio Risk and Return: Part I', 'Portfolio Risk and Return: Part II', 'Portfolio Management: An Overview', 'Basics of Portfolio Planning and Construction', 'The Behavioral Biases of Individuals', 'Introduction to Risk Management'],
  ethics: ['Ethics and Trust in the Investment Profession', 'Code of Ethics and Standards of Professional Conduct', 'Guidance for Standard I: Professionalism', 'Guidance for Standard II: Integrity of Capital Markets', 'Guidance for Standard III: Duties to Clients', 'Guidance for Standard IV: Duties to Employers', 'Guidance for Standard V: Investment Analysis, Recommendations, and Actions', 'Guidance for Standard VI: Conflicts of Interest', 'Guidance for Standard VII: Responsibilities as a CFA Institute Member or CFA Candidate', 'Application of the Code and Standards: Level I'],
};
export const moduleKey = (topicId, i) => `${topicId}-${i}`;

export const LENSES = [
  { id: 'company',    name: 'The Company',          sub: 'How it is run, funded, and reported' },
  { id: 'securities', name: 'The Securities',       sub: 'Pricing the claims on the company' },
  { id: 'toolkit',    name: 'The Investor\'s Toolkit', sub: 'Managing risk and building portfolios' },
  { id: 'tools',      name: 'The Lenses',           sub: 'The environment and the measuring tools' },
  { id: 'rules',      name: 'The Rules',            sub: 'What every move must comply with' },
];

export const topicById = (id) => TOPICS.find((t) => t.id === id);

// The order that builds the picture: tools → company → securities → toolkit → rules.
export const RECOMMENDED_ORDER = ['quant', 'econ', 'corp', 'fsa', 'equity', 'fi', 'deriv', 'alt', 'pm', 'ethics'];

export const RANKS = [
  { xp: 0, name: 'Intern' },
  { xp: 300, name: 'Junior Analyst' },
  { xp: 900, name: 'Analyst' },
  { xp: 2000, name: 'Senior Analyst' },
  { xp: 3800, name: 'Associate' },
  { xp: 6500, name: 'Vice President' },
  { xp: 10000, name: 'Director' },
  { xp: 15000, name: 'Portfolio Manager' },
  { xp: 22000, name: 'Chief Investment Officer' },
];

export function rankFor(xp) {
  let i = 0;
  while (i + 1 < RANKS.length && xp >= RANKS[i + 1].xp) i++;
  const cur = RANKS[i], next = RANKS[i + 1];
  const pct = next ? (xp - cur.xp) / (next.xp - cur.xp) : 1;
  return { ...cur, next, pct, index: i };
}

// Story worlds: one company followed through all 10 topics.
export const WORLDS = [
  { id: 'roastery', company: 'Northwind Roastery', industry: 'Specialty coffee chain and packaged coffee brand',
    tagline: 'From one café to a listed company.',
    cast: [
      { key: 'you', name: 'You', role: 'newly hired CFO, later an analyst and portfolio manager as the story moves' },
      { key: 'ceo', name: 'Dana Okafor', role: 'founder and CEO, ambitious and impatient' },
      { key: 'chair', name: 'Victor Hale', role: 'board chair, skeptical ex-banker' },
      { key: 'analyst', name: 'Priya Raman', role: 'sell-side analyst who covers the company' },
      { key: 'investor', name: 'Marcus Bell', role: 'pension fund portfolio manager and major shareholder' },
    ] },
  { id: 'energy', company: 'Voltara Energy', industry: 'Solar farm and battery storage developer',
    tagline: 'Powering up — and paying for it.',
    cast: [
      { key: 'you', name: 'You', role: 'newly hired CFO, later an analyst and portfolio manager as the story moves' },
      { key: 'ceo', name: 'Ada Mensah', role: 'engineer-turned-CEO with big expansion plans' },
      { key: 'chair', name: 'Robert Lin', role: 'board chair focused on risk' },
      { key: 'analyst', name: 'Sofia Grant', role: 'credit analyst at a rating agency' },
      { key: 'investor', name: 'Kwame Osei', role: 'infrastructure fund manager' },
    ] },
  { id: 'athletic', company: 'Stride Athletic', industry: 'Sportswear and football boot brand',
    tagline: 'Built for the pitch, priced by the market.',
    cast: [
      { key: 'you', name: 'You', role: 'newly hired CFO, later an analyst and portfolio manager as the story moves' },
      { key: 'ceo', name: 'Tomi Adeyemi', role: 'former pro player turned founder-CEO' },
      { key: 'chair', name: 'Helen Brooks', role: 'board chair and former retail executive' },
      { key: 'analyst', name: 'Ravi Patel', role: 'equity analyst covering consumer brands' },
      { key: 'investor', name: 'Claire Dubois', role: 'activist hedge fund manager' },
    ] },
  { id: 'health', company: 'Lumen Health', industry: 'Digital health software company',
    tagline: 'Growth now, profits later?',
    cast: [
      { key: 'you', name: 'You', role: 'newly hired CFO, later an analyst and portfolio manager as the story moves' },
      { key: 'ceo', name: 'Noah Kim', role: 'visionary founder-CEO' },
      { key: 'chair', name: 'Grace Achebe', role: 'board chair and former regulator' },
      { key: 'analyst', name: 'Leo Martins', role: 'tech analyst at an investment bank' },
      { key: 'investor', name: 'Ivy Chen', role: 'venture capital partner and early backer' },
    ] },
];

export function worldText(world) {
  if (!world) return '';
  const cast = world.cast.map((c) => `- ${c.name}: ${c.role}`).join('\n');
  return `Company: ${world.company} (${world.industry}). Tagline: ${world.tagline}\nRecurring cast:\n${cast}`;
}

// Replace {{company}}, {{ceo}}, {{chair}}, {{analyst}}, {{investor}} in demo text.
export function personalize(text, world) {
  if (!world || typeof text !== 'string') return text;
  const map = { company: world.company };
  for (const c of world.cast) map[c.key] = c.name;
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => map[k] ?? m);
}

// ---------- Demo level (written for illustration, not taken from the curriculum) ----------
export const DEMO_LEVEL = {
  id: 'demo-cost-of-capital',
  topicId: 'corp',
  source: 'demo',
  title: 'Cost of Capital (Demo)',
  module: 'Demo level',
  storyBeat: '{{company}} needed a hurdle rate for a new roasting plant; you built its WACC from the cost of debt and equity.',
  los: [
    { id: 'a', text: 'Calculate and interpret the weighted average cost of capital (WACC)' },
    { id: 'b', text: 'Explain why and how the cost of debt is adjusted for taxes, and estimate it' },
    { id: 'c', text: 'Estimate the cost of equity using CAPM and the bond-yield-plus-risk-premium approach' },
    { id: 'd', text: 'Estimate the cost of preferred stock' },
  ],
  map: {
    bigPicture: 'Every source of money has a price. WACC blends those prices into one hurdle rate that projects must beat.',
    why: 'Too low a hurdle accepts value-destroying projects; too high rejects good ones.',
    links: ['Cost of debt + cost of preferred + cost of equity → weighted → WACC', 'WACC = hurdle rate only for average-risk projects'],
    sections: [
      { id: 's1', title: 'What WACC is', gist: 'A weighted blend of what every capital provider requires.', keywords: ['hurdle rate', 'target weights', 'market values'], losIds: ['a'],
        blocks: [
          { type: 'formula', formula: 'WACC = wd × rd × (1 − t) + wp × rp + we × re', vars: [{ sym: 'wd, wp, we', means: 'weights of debt, preferred, equity (sum to 1)' }, { sym: 'rd', means: 'before-tax cost of debt' }, { sym: 't', means: 'marginal tax rate' }, { sym: 'rp', means: 'cost of preferred stock' }, { sym: 're', means: 'cost of common equity' }], note: 'Only debt gets the (1 − t) adjustment.' },
          { type: 'compare', title: 'Which weights?', columns: ['', 'Use', 'Avoid'], rows: [['Best', 'Target capital structure', 'Book values'], ['If target unknown', 'Current market values', 'Equal weights']] },
          { type: 'points', items: ['WACC = minimum return for projects of **average company risk**', 'Riskier project → needs a **higher** rate than WACC'] },
          { type: 'trap', text: 'Book values are on the balance sheet, but the exam wants target or market-value weights.' },
        ] },
      { id: 's2', title: 'Cost of debt and the tax shield', gist: 'Interest is tax-deductible, so debt costs less after tax.', keywords: ['YTM approach', 'debt-rating approach', 'rd × (1 − t)'], losIds: ['b'],
        blocks: [
          { type: 'formula', formula: 'After-tax cost of debt = rd × (1 − t)', vars: [{ sym: 'rd', means: 'current YTM on long-term debt' }, { sym: 't', means: 'marginal tax rate' }] },
          { type: 'group', title: 'Two ways to estimate rd', items: [{ label: 'YTM approach', note: 'Yield investors demand today on existing debt' }, { label: 'Debt-rating approach', note: 'No traded debt? Use yields on same-rated, similar-maturity bonds' }] },
          { type: 'trap', text: 'Coupon rate ≠ cost of debt. Coupon reflects conditions when the bond was issued.' },
          { type: 'example', text: 'YTM 6%, tax 25% → 6% × 0.75 = 4.5% after tax.' },
        ] },
      { id: 's3', title: 'Cost of equity', gist: 'No stated rate — estimate it from risk.', keywords: ['CAPM', 'beta', 'bond yield + premium'], losIds: ['c'],
        blocks: [
          { type: 'formula', formula: 're = rf + β × (E(Rm) − rf)', vars: [{ sym: 'rf', means: 'risk-free rate' }, { sym: 'β', means: 'sensitivity to market moves' }, { sym: 'E(Rm) − rf', means: 'equity risk premium' }], note: 'CAPM' },
          { type: 'formula', formula: 're = own long-term bond YTM + risk premium', vars: [{ sym: 'risk premium', means: 'judgement estimate, typically a few %' }], note: 'Bond yield plus risk premium' },
          { type: 'flow', title: 'Why equity costs more', steps: ['Shareholders paid last', 'More risk', 'Higher required return'] },
          { type: 'trap', text: 'Given E(Rm)? Subtract rf first. Given the premium? Use it directly.' },
        ] },
      { id: 's4', title: 'Cost of preferred stock', gist: 'Fixed dividend ÷ price. No tax adjustment.', keywords: ['Dp / Pp', 'no tax shield'], losIds: ['d'],
        blocks: [
          { type: 'formula', formula: 'rp = Dp / Pp', vars: [{ sym: 'Dp', means: 'fixed preferred dividend' }, { sym: 'Pp', means: 'current preferred price' }] },
          { type: 'points', items: ['Preferred dividends are **not** tax-deductible → no (1 − t)'] },
          { type: 'example', text: '$5 dividend, $62.50 price → 8%.' },
        ] },
    ],
  },
  briefing: {
    headline: 'The board wants a number by Friday',
    story: '{{company}} is weighing a new facility that would double capacity. {{ceo}} is sure it will pay off. {{chair}} is not convinced: "Every project looks good until you charge it for the money it uses. What does our capital actually cost us?"\n\nYou have just been hired as CFO. Your first job is to work out the minimum return any new project must earn — the **hurdle rate** — before the board will approve a single dollar.',
    stakes: 'If the hurdle rate is too low, the company accepts projects that destroy value. Too high, and it walks away from good ones.',
  },
  missions: [
    {
      id: 'm1', title: 'What does money cost?', losIds: ['a'],
      scene: '{{chair}} slides a sheet across the table. "We fund ourselves with a mix of debt and equity. Lenders and shareholders each expect a return. Blend them properly."',
      concept: 'A company raises money from different sources — debt, preferred stock, and common equity — and each provider demands a return. The **weighted average cost of capital (WACC)** blends those required returns using the proportion of each source in the capital structure.\n\n```formula\nWACC = wd × rd × (1 − t) + wp × rp + we × re\n```\n- **wd, wp, we**: weights of debt, preferred, and common equity (they sum to 1)\n- **rd**: before-tax cost of debt; **t**: marginal tax rate\n- **rp**: cost of preferred stock; **re**: cost of common equity\n\nWeights should reflect the company\'s **target capital structure**. If the target is unknown, use current **market values** (not book values) — market values reflect what investors would pay today.\n\nWACC is the hurdle rate for projects with the **same risk** as the company\'s existing business. A riskier project needs a higher rate.',
      keyPoints: [
        'WACC = weighted blend of after-tax cost of debt, cost of preferred, and cost of equity',
        'Use target weights; if unknown, current market-value weights',
        'Only valid as a hurdle rate for projects of average company risk',
      ],
      check: {
        id: 'm1q', type: 'mcq', losId: 'a',
        prompt: '{{company}} has a target structure of 40% debt and 60% equity, but book values show 25% debt. Which weights belong in the WACC?',
        options: ['The 25% / 75% book-value weights', 'The 40% / 60% target weights', 'Equal 50% / 50% weights'],
        answer: 1,
        explanation: 'WACC should use the target capital structure because it reflects how the company will fund future projects. Book values are historical and can be far from what investors would pay today.',
        trap: 'Book values are tempting because they are on the balance sheet — the exam rewards target or market-value weights.',
      },
    },
    {
      id: 'm2', title: 'The tax shield', losIds: ['b'],
      scene: '{{ceo}} frowns: "Our bonds yield 6%. So debt costs 6%, right?" You shake your head — the tax authorities pay part of that bill.',
      concept: 'Interest on debt is generally **tax-deductible**, so the government effectively subsidises part of the cost. Dividends to shareholders are paid from after-tax profit and get no deduction. That is why only the cost of debt is adjusted:\n\n```formula\nAfter-tax cost of debt = rd × (1 − t)\n```\n**Estimating rd:**\n- **Yield-to-maturity approach**: rd is the YTM on the company\'s existing long-term debt — the rate investors currently demand, not the coupon rate.\n- **Debt-rating approach**: if the company\'s debt doesn\'t trade, use the yield on comparably rated bonds with similar maturity.\n\nThe coupon rate is a trap — it reflects market conditions when the bond was issued, not today.',
      keyPoints: [
        'Interest is deductible, so cost of debt is multiplied by (1 − t)',
        'Use the current YTM, not the coupon rate',
        'No traded debt? Use yields on comparably rated bonds',
      ],
      check: {
        id: 'm2q', type: 'calc', losId: 'b',
        prompt: '{{company}}\'s bonds have a coupon of 5% but currently trade at a yield to maturity of {rd}. The marginal tax rate is {t}. What is the after-tax cost of debt?',
        variables: {
          rd: { value: 0.06, min: 0.04, max: 0.09, step: 0.0025, unit: '%', decimals: 2, label: 'YTM' },
          t: { value: 0.25, min: 0.2, max: 0.35, step: 0.01, unit: '%', decimals: 0, label: 'Tax rate' },
        },
        steps: [
          { id: 'atd', label: 'After-tax cost of debt', expr: 'rd * (1 - t)', unit: '%', decimals: 2, hint: 'Use the YTM, then multiply by (1 − t).' },
        ],
        explanation: 'Use the YTM (the market\'s current required return), not the 5% coupon, then apply the tax shield: rd × (1 − t).',
        keystrokes: ['6 × ( 1 − 0.25 ) = → 4.5  (enter your own numbers)'],
      },
    },
    {
      id: 'm3', title: 'What shareholders demand', losIds: ['c', 'd'],
      scene: '{{investor}} calls. "Shareholders take the most risk — we\'re paid last. Show me you know what we expect."',
      concept: 'Equity has no stated rate, so its cost must be **estimated**.\n\n**1. CAPM (capital asset pricing model):**\n```formula\nre = rf + β × (E(Rm) − rf)\n```\n- **rf**: risk-free rate; **β**: sensitivity of the stock to market moves; **E(Rm) − rf**: equity risk premium\n- β above 1 means more systematic risk, so a higher required return\n\n**2. Bond yield plus risk premium:**\n```formula\nre = rd (company\'s own long-term bond YTM) + risk premium\n```\nShareholders rank below bondholders, so they demand more than the company\'s own debt yield. The premium is a judgement estimate (commonly a few percentage points).\n\n**Cost of preferred stock** (fixed dividend, no maturity):\n```formula\nrp = Dp / Pp\n```\nwhere Dp is the preferred dividend and Pp the current preferred price. Preferred dividends are not tax-deductible, so no tax adjustment.',
      keyPoints: [
        'CAPM: re = rf + β × equity risk premium',
        'Bond yield plus risk premium: own bond YTM + a premium',
        'Preferred: rp = Dp / Pp, no tax adjustment',
      ],
      check: {
        id: 'm3q', type: 'calc', losId: 'c',
        prompt: 'The risk-free rate is {rf}, {{company}}\'s beta is {beta}, and the equity risk premium is {erp}. Estimate the cost of equity with CAPM.',
        variables: {
          rf: { value: 0.04, min: 0.02, max: 0.05, step: 0.0025, unit: '%', decimals: 2, label: 'Risk-free rate' },
          beta: { value: 1.2, min: 0.7, max: 1.6, step: 0.05, unit: '', decimals: 2, label: 'Beta' },
          erp: { value: 0.055, min: 0.04, max: 0.07, step: 0.0025, unit: '%', decimals: 2, label: 'Equity risk premium' },
        },
        steps: [
          { id: 'prem', label: 'Beta × equity risk premium', expr: 'beta * erp', unit: '%', decimals: 2, hint: 'Multiply beta by the premium (not by the market return).' },
          { id: 're', label: 'Cost of equity', expr: 'rf + prem', unit: '%', decimals: 2, hint: 'Add the risk-free rate.' },
        ],
        explanation: 'CAPM: re = rf + β × ERP. Watch whether the question gives the equity risk premium or the expected market return — if it gives the market return, subtract rf first.',
        keystrokes: ['1.2 × 5.5 = → 6.6', '+ 4 = → 10.6'],
      },
    },
  ],
  fieldManual: [
    { term: 'WACC', definition: 'Blend of the required returns of all capital providers, weighted by the target capital structure.', formula: 'WACC = wd·rd(1−t) + wp·rp + we·re', trap: 'Use target or market-value weights, not book values.' },
    { term: 'After-tax cost of debt', definition: 'The effective cost of borrowing once the tax deductibility of interest is counted.', formula: 'rd × (1 − t)', trap: 'Use current YTM, not the coupon rate.' },
    { term: 'Debt-rating approach', definition: 'Estimating rd from yields on bonds with the same rating and similar maturity, used when the company\'s debt is not traded.' },
    { term: 'CAPM', definition: 'Required return equals the risk-free rate plus beta times the equity risk premium.', formula: 're = rf + β(E(Rm) − rf)', trap: 'If given E(Rm), subtract rf to get the premium.' },
    { term: 'Bond yield plus risk premium', definition: 'Cost of equity estimated as the company\'s own long-term bond yield plus a judgemental premium for equity\'s extra risk.', formula: 're = rd + RP' },
    { term: 'Cost of preferred stock', definition: 'Required return on preferred shares with a fixed dividend and no maturity.', formula: 'rp = Dp / Pp', trap: 'No tax adjustment — preferred dividends are not deductible.' },
    { term: 'Hurdle rate', definition: 'Minimum return a project must earn. WACC is appropriate only for projects of average company risk.' },
  ],
  boss: [
    {
      id: 'b1', type: 'calc', losId: 'a',
      prompt: '{{company}} has equity worth ${E}m and debt worth ${D}m at market value (treat these as the target mix). Pre-tax cost of debt is {rd}, the tax rate is {t}, and cost of equity is {re}. Calculate the WACC.',
      variables: {
        E: { value: 600, min: 300, max: 900, step: 50, unit: '', decimals: 0, label: 'Equity ($m)' },
        D: { value: 400, min: 100, max: 600, step: 50, unit: '', decimals: 0, label: 'Debt ($m)' },
        rd: { value: 0.06, min: 0.04, max: 0.08, step: 0.0025, unit: '%', decimals: 2, label: 'Pre-tax cost of debt' },
        t: { value: 0.25, min: 0.2, max: 0.3, step: 0.01, unit: '%', decimals: 0, label: 'Tax rate' },
        re: { value: 0.11, min: 0.09, max: 0.14, step: 0.0025, unit: '%', decimals: 2, label: 'Cost of equity' },
      },
      steps: [
        { id: 'wd', label: 'Weight of debt', expr: 'D / (D + E)', unit: '', decimals: 4, hint: 'Debt ÷ total capital.' },
        { id: 'we', label: 'Weight of equity', expr: 'E / (D + E)', unit: '', decimals: 4, hint: 'Equity ÷ total capital (or 1 − wd).' },
        { id: 'atd', label: 'After-tax cost of debt', expr: 'rd * (1 - t)', unit: '%', decimals: 2, hint: 'rd × (1 − t).' },
        { id: 'wacc', label: 'WACC', expr: 'wd * atd + we * re', unit: '%', decimals: 2, hint: 'wd × after-tax rd + we × re.' },
      ],
      explanation: 'Weights from market values, debt cost adjusted for tax, equity cost not adjusted.',
      keystrokes: ['400 ÷ 1000 = → 0.4 (wd)', '6 × 0.75 = → 4.5 (after-tax rd)', '0.4 × 4.5 + 0.6 × 11 = → 8.4 (WACC %)'],
    },
    {
      id: 'b2', type: 'mcq', losId: 'b',
      prompt: 'Why is the cost of debt adjusted for taxes in the WACC while the cost of common equity is not?',
      options: [
        'Interest payments are tax-deductible, while dividends are paid from after-tax income',
        'Debt is less risky than equity, so it receives a tax discount',
        'Equity investors pay personal tax on dividends, which already lowers the cost',
      ],
      answer: 0,
      explanation: 'The deduction for interest reduces the company\'s tax bill — a benefit dividends do not get.',
    },
    {
      id: 'b3', type: 'mcq', losId: 'b',
      prompt: '{{company}}\'s debt does not trade. Which approach best estimates its before-tax cost of debt?',
      options: [
        'Use the coupon rate on its most recent loan',
        'Use the yield on publicly traded bonds with the same credit rating and similar maturity',
        'Use the risk-free rate plus the equity risk premium',
      ],
      answer: 1,
      explanation: 'The debt-rating approach uses yields on comparably rated, similar-maturity debt as a proxy for what lenders would demand today.',
    },
    {
      id: 'b4', type: 'calc', losId: 'c',
      prompt: '{{company}}\'s long-term bonds yield {ytm}. An analyst adds a risk premium of {rp} for equity\'s extra risk. Using the bond-yield-plus-risk-premium approach, what is the cost of equity?',
      variables: {
        ytm: { value: 0.065, min: 0.04, max: 0.08, step: 0.0025, unit: '%', decimals: 2, label: 'Bond YTM' },
        rp: { value: 0.04, min: 0.03, max: 0.05, step: 0.0025, unit: '%', decimals: 2, label: 'Risk premium' },
      },
      steps: [{ id: 're', label: 'Cost of equity', expr: 'ytm + rp', unit: '%', decimals: 2, hint: 'Own bond yield + premium.' }],
      explanation: 'Equity is junior to the company\'s own debt, so its cost is the bond yield plus a premium.',
      keystrokes: ['6.5 + 4 = → 10.5'],
    },
    {
      id: 'b5', type: 'calc', losId: 'd',
      prompt: '{{company}}\'s preferred shares pay a fixed annual dividend of ${Dp} and trade at ${Pp}. What is the cost of preferred stock?',
      variables: {
        Dp: { value: 5, min: 3, max: 8, step: 0.25, unit: '', decimals: 2, label: 'Dividend' },
        Pp: { value: 62.5, min: 40, max: 100, step: 2.5, unit: '', decimals: 2, label: 'Price' },
      },
      steps: [{ id: 'rp', label: 'Cost of preferred', expr: 'Dp / Pp', unit: '%', decimals: 2, hint: 'Dividend ÷ price.' }],
      explanation: 'rp = Dp / Pp. No tax adjustment because preferred dividends are not deductible.',
      keystrokes: ['5 ÷ 62.5 = → 0.08 → 8%'],
    },
    {
      id: 'b6', type: 'mcq', losId: 'a',
      prompt: 'A proposed project is significantly riskier than {{company}}\'s existing business. Using the company WACC as its discount rate would most likely:',
      options: [
        'Correctly value the project, because WACC reflects all company risk',
        'Understate the project\'s risk and overstate its value',
        'Overstate the project\'s risk and understate its value',
      ],
      answer: 1,
      explanation: 'WACC fits projects of average company risk. A riskier project needs a higher rate; using WACC discounts its cash flows too lightly and makes it look better than it is.',
    },
  ],
};
