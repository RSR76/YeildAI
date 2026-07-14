'use client';

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell, ReferenceLine, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, LineChart as LineChartComponent,
} from "recharts";
import {
  Sprout, Wheat, Leaf, TrendingUp, CloudRain, AlertTriangle,
  ShieldCheck, ArrowUpRight, ArrowDownRight,
  Info, Landmark, Truck, Gauge, Sparkles,
} from "lucide-react";

import './dashboard.css';

/* ------------------------------------------------------------------ */
/* MOCK DATA                                                           */
/* ------------------------------------------------------------------ */

const crops = [
  {
    id: "soybean", name: "Soybean", icon: Sprout, recommended: true,
    profit: 42600, profitDelta: 38, confidence: 87,
    demand: 76, supply: 34, balance: 42,
    risk: { weather: "Low", volatility: "Low", oversupply: "Low" },
    riskScore: 18,
    spark: [22, 28, 24, 31, 38, 40, 47, 52],
    msp: 4892, market: 5210,
  },
  {
    id: "cotton", name: "Cotton", icon: Leaf, recommended: true,
    profit: 39800, profitDelta: 29, confidence: 81,
    demand: 68, supply: 41, balance: 27,
    risk: { weather: "Medium", volatility: "Medium", oversupply: "Low" },
    riskScore: 34,
    spark: [40, 38, 35, 39, 44, 46, 50, 55],
    msp: 7121, market: 7460,
  },
  {
    id: "maize", name: "Maize", icon: Sprout, recommended: true,
    profit: 33150, profitDelta: 19, confidence: 74,
    demand: 61, supply: 49, balance: 12,
    risk: { weather: "Medium", volatility: "Low", oversupply: "Medium" },
    riskScore: 38,
    spark: [30, 33, 31, 35, 33, 37, 39, 41],
    msp: 2225, market: 2390,
  },
  {
    id: "turdal", name: "Tur (Pigeon Pea)", icon: Leaf, recommended: false,
    profit: 30250, profitDelta: 9, confidence: 68,
    demand: 55, supply: 52, balance: 3,
    risk: { weather: "Medium", volatility: "Medium", oversupply: "Medium" },
    riskScore: 44,
    spark: [26, 27, 29, 28, 30, 29, 31, 30],
    msp: 7550, market: 7690,
  },
  {
    id: "onion", name: "Onion", icon: Sprout, recommended: false,
    profit: 27400, profitDelta: -4, confidence: 58,
    demand: 48, supply: 57, balance: -9,
    risk: { weather: "High", volatility: "High", oversupply: "Medium" },
    riskScore: 61,
    spark: [45, 40, 42, 36, 38, 33, 30, 28],
    msp: null, market: 1840,
  },
  {
    id: "wheat", name: "Wheat", icon: Wheat, recommended: false,
    profit: 21300, profitDelta: -22, confidence: 91,
    demand: 39, supply: 78, balance: -39,
    risk: { weather: "Low", volatility: "Low", oversupply: "High" },
    riskScore: 72,
    spark: [50, 49, 47, 44, 41, 38, 34, 30],
    msp: 2425, market: 2260,
  },
];

const priceForecast = [
  { m: "Feb", actual: 4620, lower: null, upper: null, predicted: null },
  { m: "Mar", actual: 4740, lower: null, upper: null, predicted: null },
  { m: "Apr", actual: 4810, lower: null, upper: null, predicted: null },
  { m: "May", actual: 4990, lower: null, upper: null, predicted: 4990 },
  { m: "Jun", actual: null, lower: 4920, upper: 5240, predicted: 5080 },
  { m: "Jul", actual: null, lower: 4980, upper: 5390, predicted: 5180 },
  { m: "Aug", actual: null, lower: 5040, upper: 5520, predicted: 5260 },
  { m: "Sep", actual: null, lower: 5060, upper: 5640, predicted: 5320 },
  { m: "Oct", actual: null, lower: 5090, upper: 5760, predicted: 5390 },
];

const arrivals = [
  { w: "W1", tonnes: 1120 }, { w: "W2", tonnes: 1340 }, { w: "W3", tonnes: 1290 },
  { w: "W4", tonnes: 1510 }, { w: "W5", tonnes: 1680 }, { w: "W6", tonnes: 1590 },
  { w: "W7", tonnes: 1820 }, { w: "W8", tonnes: 2010 },
];

const riskAxes = [
  { subject: "Weather", key: "weather" },
  { subject: "Price volatility", key: "volatility" },
  { subject: "Oversupply", key: "oversupply" },
  { subject: "Logistics", key: "logistics" },
  { subject: "Water access", key: "water" },
];

const riskValues = {
  soybean: { weather: 22, volatility: 20, oversupply: 15, logistics: 30, water: 25 },
  wheat:   { weather: 18, volatility: 22, oversupply: 82, logistics: 28, water: 20 },
};

const insights = [
  {
    icon: TrendingUp,
    tone: "good",
    title: "Soybean demand outpacing regional supply",
    body: "Processor buying interest in the Nashik belt has risen while mandi arrivals stayed flat, widening the demand-supply gap to +42.",
  },
  {
    icon: AlertTriangle,
    tone: "warn",
    title: "Wheat oversupply risk is high this season",
    body: "68% of nearby holdings sowed wheat last cycle. Projected arrivals exceed 5-year average procurement capacity by 19%.",
  },
  {
    icon: CloudRain,
    tone: "neutral",
    title: "Rainfall outlook favours cotton in weeks 3–6",
    body: "IMD forecast shows near-normal monsoon distribution across the district, reducing irrigation dependency for cotton plots.",
  },
  {
    icon: Landmark,
    tone: "good",
    title: "MSP margin strongest for soybean and cotton",
    body: "Market prices are tracking 6–7% above MSP for both crops, versus wheat trading 7% below its support price.",
  },
];

/* ------------------------------------------------------------------ */
/* SMALL UI PRIMITIVES                                                 */
/* ------------------------------------------------------------------ */

const riskColor = (level: string) =>
  level === "Low" ? "var(--forest-600)" : level === "Medium" ? "var(--gold-500)" : "var(--clay-500)";
const riskBg = (level: string) =>
  level === "Low" ? "var(--sage-100)" : level === "Medium" ? "var(--gold-100)" : "var(--clay-100)";

function RiskPill({ level }: { level: string }) {
  return (
    <span
      className="risk-pill"
      style={{ color: riskColor(level), background: riskBg(level), borderColor: riskColor(level) + "33" }}
    >
      <span className="risk-dot" style={{ background: riskColor(level) }} />
      {level}
    </span>
  );
}

function Sparkline({ data, positive }: { data: number[], positive: boolean }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChartComponent data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line
          type="monotone" dataKey="v" stroke={positive ? "var(--forest-600)" : "var(--clay-500)"}
          strokeWidth={2} dot={false}
        />
      </LineChartComponent>
    </ResponsiveContainer>
  );
}

/* Semi-circle "AI confidence" gauge — the signature visual */
function ConfidenceGauge({ value = 87, size = 168 }) {
  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  const startAngle = 180, endAngle = 0;
  const angle = 180 - (value / 100) * 180;
  const toXY = (deg: number) => {
    const rad = (deg * Math.PI) / 180;
    return [cx - r * Math.cos(rad), cy - r * Math.sin(rad)];
  };
  const [x1, y1] = toXY(startAngle);
  const [x2, y2] = toXY(endAngle);
  const [nx, ny] = toXY(angle);
  const arcPath = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;
  const valuePath = () => {
    const [vx, vy] = toXY(angle);
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${vx} ${vy}`;
  };
  return (
    <div style={{ position: "relative", width: size, height: size * 0.62 }}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <defs>
          <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="var(--clay-500)" />
            <stop offset="50%" stopColor="var(--gold-500)" />
            <stop offset="100%" stopColor="var(--forest-600)" />
          </linearGradient>
        </defs>
        <path d={arcPath} fill="none" stroke="rgba(20,49,42,0.08)" strokeWidth="12" strokeLinecap="round" />
        <path d={valuePath()} fill="none" stroke="url(#gaugeGrad)" strokeWidth="12" strokeLinecap="round" />
        <circle cx={nx} cy={ny} r="6.5" fill="var(--surface)" stroke="var(--forest-700)" strokeWidth="2.5" />
      </svg>
      <div style={{ position: "absolute", top: "58%", left: "50%", transform: "translate(-50%,-50%)", textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 30, fontWeight: 600, color: "var(--forest-900)", lineHeight: 1 }}>
          {value}%
        </div>
        <div style={{ fontSize: 10.5, letterSpacing: "0.06em", color: "var(--ink-soft)", textTransform: "uppercase", marginTop: 3 }}>
          AI confidence
        </div>
      </div>
    </div>
  );
}

function GlassCard({ children, className = "", style = {}, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return <div className={`glass-card ${className}`} style={style} onClick={onClick}>{children}</div>;
}

function SectionLabel({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: any }) {
  return (
    <div className="section-label">
      <div className="section-eyebrow">
        {Icon && <Icon size={13} />} {eyebrow}
      </div>
      <h3>{title}</h3>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN DASHBOARD                                                      */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const [selectedCrop, setSelectedCrop] = useState("soybean");
  const top = crops.find((c) => c.id === "soybean")!;
  const wheat = crops.find((c) => c.id === "wheat")!;
  const active = crops.find((c) => c.id === selectedCrop) || top;

  const balanceData = useMemo(
    () => [...crops].sort((a, b) => b.balance - a.balance).map((c) => ({ ...c })),
    []
  );

  const radarData = riskAxes.map((ax) => ({
    subject: ax.subject,
    Soybean: riskValues.soybean[ax.key as keyof typeof riskValues.soybean],
    Wheat: riskValues.wheat[ax.key as keyof typeof riskValues.wheat],
  }));

  return (
    <div className="dash-root">
      {/* MAIN */}
      <div className="main-col">
        {/* HERO RECOMMENDATION */}
        <GlassCard className="hero">
          <div className="hero-grid">
            <div>
              <span className="hero-eyebrow"><Sparkles size={12} /> Top AI recommendation</span>
              <h1 className="hero-title">Plant <em>Soybean</em> this season —<br />not wheat again.</h1>
              <p className="hero-desc">
                Demand from regional processors is rising faster than supply, while wheat holdings in
                your district already exceed procurement capacity. Soybean offers the strongest
                risk-adjusted return this cycle.
              </p>
              <div className="hero-stats">
                <div>
                  <div className="hero-stat-label">Projected profit / acre</div>
                  <div className="hero-stat-value">₹{top.profit.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <div className="hero-stat-label">Vs. wheat (last cycle)</div>
                  <div className="hero-stat-value pos"><ArrowUpRight size={16} style={{ verticalAlign: "-2px" }} /> +{top.profitDelta}%</div>
                </div>
                <div>
                  <div className="hero-stat-label">Demand–supply balance</div>
                  <div className="hero-stat-value pos">+{top.balance}</div>
                </div>
              </div>
              <div className="hero-chips">
                <span className="chip"><TrendingUp size={13} color="var(--forest-600)" /> Demand rising</span>
                <span className="chip"><ShieldCheck size={13} color="var(--forest-600)" /> Low oversupply risk</span>
                <span className="chip"><Landmark size={13} color="var(--gold-500)" /> Trading above MSP</span>
                <span className="chip"><CloudRain size={13} color="var(--forest-600)" /> Favourable rainfall</span>
              </div>
            </div>

            <div className="hero-divider" />

            <div className="hero-side">
              <div className="hero-gauge-wrap">
                <ConfidenceGauge value={top.confidence} />
                <div className="hero-cta"><ShieldCheck size={14} /> View full reasoning</div>
              </div>
              <div>
                <div className="compare-row">
                  <span className="compare-name"><Sprout size={14} color="var(--forest-600)" /> Soybean profit</span>
                  <span className="compare-badge" style={{ color: "var(--forest-600)" }}>₹{top.profit.toLocaleString("en-IN")}</span>
                </div>
                <div className="compare-row">
                  <span className="compare-name"><Wheat size={14} color="var(--clay-500)" /> Wheat profit</span>
                  <span className="compare-badge" style={{ color: "var(--clay-500)" }}>₹{wheat.profit.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* DEMAND VS SUPPLY + PRICE FORECAST */}
        <div className="row row-2">
          <GlassCard>
            <SectionLabel eyebrow="Core signal" title="Demand–supply balance by crop" icon={Gauge} />
            <div className="legend-row" style={{ marginBottom: 6 }}>
              <span><span className="legend-dot" style={{ background: "var(--forest-600)" }} />Undersupplied — opportunity</span>
              <span><span className="legend-dot" style={{ background: "var(--clay-500)" }} />Oversupplied — risk</span>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={balanceData} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" horizontal={false} />
                <XAxis type="number" domain={[-60, 60]} tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={118} tick={{ fontSize: 12.5, fill: "var(--forest-900)" }} axisLine={false} tickLine={false} />
                <ReferenceLine x={0} stroke="var(--ink-soft)" />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", fontSize: 12.5, fontFamily: "var(--font-body)" }}
                  formatter={(v: any) => [`${(v as number) > 0 ? "+" : ""}${v}`, "Balance"]}
                />
                <Bar dataKey="balance" radius={[6, 6, 6, 6]} barSize={16}>
                  {balanceData.map((d) => (
                    <Cell key={d.id} fill={d.balance >= 0 ? "var(--forest-600)" : "var(--clay-500)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>

          <GlassCard>
            <SectionLabel eyebrow="12-week outlook" title="Soybean price forecast" icon={TrendingUp} />
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={priceForecast} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold-500)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--gold-500)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="m" tick={{ fontSize: 11.5, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                <YAxis domain={[4500, 5900]} tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", fontSize: 12.5, fontFamily: "var(--font-body)" }} />
                <Area dataKey={(d) => (d.lower != null ? [d.lower, d.upper] : null)} stroke="none" fill="url(#bandFill)" name="Confidence band" />
                <Line type="monotone" dataKey="actual" stroke="var(--forest-900)" strokeWidth={2.5} dot={{ r: 3 }} name="Actual price (₹/qtl)" connectNulls={false} />
                <Line type="monotone" dataKey="predicted" stroke="var(--gold-500)" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3 }} name="Predicted price (₹/qtl)" connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <span><span className="legend-dot" style={{ background: "var(--forest-900)" }} />Actual</span>
              <span><span className="legend-dot" style={{ background: "var(--gold-500)" }} />Predicted</span>
              <span><span className="legend-dot" style={{ background: "var(--gold-500)", opacity: 0.35 }} />Confidence band</span>
            </div>
          </GlassCard>
        </div>

        {/* CROP OPPORTUNITY GRID */}
        <SectionLabel eyebrow="Ranked by AI" title="Crop opportunity comparison" icon={Gauge} />
        <div className="crop-grid" style={{ marginTop: 0 }}>
          {crops.map((c) => (
            <GlassCard
              key={c.id}
              className={`crop-card ${selectedCrop === c.id ? "selected" : ""}`}
              onClick={() => setSelectedCrop(c.id)}
            >
              <div className="crop-card-top">
                <div className="crop-icon"><c.icon size={17} /></div>
                {c.recommended && <span className="rec-badge">Recommended</span>}
              </div>
              <div className="crop-name">{c.name}</div>
              <div className="crop-profit">₹{c.profit.toLocaleString("en-IN")}</div>
              <div className="crop-profit-sub">
                predicted profit / acre ·{" "}
                <span className={`crop-delta ${c.profitDelta >= 0 ? "up" : "down"}`}>
                  {c.profitDelta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(c.profitDelta)}%
                </span>
              </div>
              <Sparkline data={c.spark} positive={c.profitDelta >= 0} />
              <div className="crop-meta-row">
                <div className="conf-bar-track"><div className="conf-bar-fill" style={{ width: `${c.confidence}%` }} /></div>
                <span className="conf-label">{c.confidence}% conf.</span>
              </div>
              <div className="crop-meta-row">
                <RiskPill level={c.risk.oversupply} />
                <span style={{ fontSize: 11.5, color: "var(--ink-soft)" }}>oversupply risk</span>
              </div>
            </GlassCard>
          ))}
        </div>

        {/* RISK RADAR + PROCUREMENT + ARRIVALS */}
        <div className="row row-3">
          <GlassCard>
            <SectionLabel eyebrow={`${active.name} vs Wheat`} title="Risk profile" icon={AlertTriangle} />
            <ResponsiveContainer width="100%" height={230}>
              <RadarChart data={radarData} outerRadius={78}>
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10.5, fill: "var(--ink-soft)" }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                <Radar name="Soybean" dataKey="Soybean" stroke="var(--forest-600)" fill="var(--forest-600)" fillOpacity={0.28} />
                <Radar name="Wheat" dataKey="Wheat" stroke="var(--clay-500)" fill="var(--clay-500)" fillOpacity={0.18} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <span><span className="legend-dot" style={{ background: "var(--forest-600)" }} />Soybean</span>
              <span><span className="legend-dot" style={{ background: "var(--clay-500)" }} />Wheat</span>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionLabel eyebrow="MSP vs. market" title="Government procurement" icon={Landmark} />
            {crops.filter((c) => c.msp).slice(0, 5).map((c) => {
              const max = 8200;
              return (
                <div className="msp-row" key={c.id}>
                  <span className="msp-name">{c.name}</span>
                  <div className="msp-track">
                    <div className="msp-fill" style={{ width: `${(c.market / max) * 100}%` }} />
                    <div className="msp-marker" style={{ left: `${(c.msp! / max) * 100}%` }} title="MSP" />
                  </div>
                  <span className="msp-value">₹{c.market.toLocaleString("en-IN")}</span>
                </div>
              );
            })}
            <div className="legend-row" style={{ marginTop: 6 }}>
              <span><span className="legend-dot" style={{ background: "var(--forest-900)", borderRadius: 1, width: 3 }} />MSP marker</span>
              <span><span className="legend-dot" style={{ background: "var(--gold-500)" }} />Market price</span>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionLabel eyebrow="Mandi trend" title="Market arrivals — Wheat" icon={Truck} />
            <ResponsiveContainer width="100%" height={150}>
              <ComposedChart data={arrivals} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="arrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--clay-500)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--clay-500)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="w" tick={{ fontSize: 10.5, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", fontSize: 12 }} />
                <Area type="monotone" dataKey="tonnes" stroke="var(--clay-500)" fill="url(#arrFill)" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="kpi-strip" style={{ marginTop: 10 }}>
              <div className="kpi-pill">
                <div className="kpi-pill-label">8-wk change</div>
                <div className="kpi-pill-value" style={{ color: "var(--clay-500)" }}>+79%</div>
              </div>
              <div className="kpi-pill">
                <div className="kpi-pill-label">Price pressure</div>
                <div className="kpi-pill-value" style={{ color: "var(--clay-500)" }}>High</div>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* AI INSIGHTS FEED */}
        <div className="row" style={{ gridTemplateColumns: "1fr" }}>
          <GlassCard>
            <SectionLabel eyebrow="Explainable AI" title="Why these recommendations" icon={Info} />
            <div>
              {insights.map((it, i) => (
                <div className="insight-item" key={i}>
                  <div className={`insight-icon ${it.tone}`}><it.icon size={16} /></div>
                  <div>
                    <div className="insight-title">{it.title}</div>
                    <div className="insight-body">{it.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
