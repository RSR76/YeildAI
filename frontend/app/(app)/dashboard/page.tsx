'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell, ReferenceLine, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, LineChart as LineChartComponent,
} from "recharts";
import {
  Sprout, Wheat, Leaf, TrendingUp, CloudRain, AlertTriangle,
  ShieldCheck, ArrowUpRight, ArrowDownRight,
  Info, Landmark, Truck, Gauge, Sparkles, MapPin, PlusCircle,
} from "lucide-react";

import './dashboard.css';
import { Loading, ErrorView } from '@/components/ui/States';
import { useAuth } from '@/lib/auth/AuthContext';
import { getRecommendations, getForecastHistory } from '@/lib/dataService';
import type { Recommendation, Forecast } from '@/lib/types';

/* ------------------------------------------------------------------ */
/* DERIVED DASHBOARD DATA                                              */
/* ------------------------------------------------------------------ */

interface DashCrop {
  id: string;
  name: string;
  icon: typeof Sprout;
  recommended: boolean;
  profit: number;
  profitDelta: number;
  confidence: number;
  demand: number;
  supply: number;
  balance: number;
  risk: { weather: string; volatility: string; oversupply: string };
  spark: number[];
  market: number;
}

const iconForCategory = (category?: string | null, name?: string) => {
  const n = (name ?? '').toLowerCase();
  if (n.includes('wheat')) return Wheat;
  const c = (category ?? '').toLowerCase();
  if (c.includes('pulse') || c.includes('fiber') || c.includes('vegetable')) return Leaf;
  return Sprout;
};

/**
 * Maps live recommendation data (per active farm) into the shape this
 * dashboard's visuals expect. Some fields — demand/supply split, weather
 * risk, and the sparkline — have no direct backend equivalent yet, so
 * they're derived deterministically from real fields (score, confidence,
 * trend) rather than randomized, so the dashboard stays illustrative but
 * consistent and still responds meaningfully to a farm switch.
 */
function toDashCrops(recommendations: Recommendation[]): DashCrop[] {
  if (recommendations.length === 0) return [];
  const minProfit = Math.min(...recommendations.map((r) => r.expectedProfit));
  const cutoff = Math.ceil(recommendations.length / 2);

  return recommendations.map((r, i) => {
    const balance = Math.max(-60, Math.min(60, Math.round((r.score - 50) * 1.2)));
    const oversupply = r.predictedTrend === 'Falling' ? 'High' : r.predictedTrend === 'Stable' ? 'Medium' : 'Low';
    const volatility = r.confidenceScore >= 0.75 ? 'Low' : r.confidenceScore >= 0.55 ? 'Medium' : 'High';
    const weather = balance >= 0 ? 'Low' : balance >= -20 ? 'Medium' : 'High';
    const trendUp = balance >= 0;
    const spark = Array.from({ length: 8 }, (_, s) => {
      const progress = s / 7;
      const drift = trendUp ? progress * 25 : -progress * 20;
      return Math.max(5, Math.round(30 + drift + (i % 3) * 3));
    });

    return {
      id: r.cropId,
      name: r.name,
      icon: iconForCategory(r.category, r.name),
      recommended: i < cutoff,
      profit: r.expectedProfit,
      profitDelta: minProfit > 0 ? Math.round(((r.expectedProfit - minProfit) / minProfit) * 100) : 0,
      confidence: Math.round(r.confidenceScore * 100),
      demand: Math.min(100, Math.round(50 + balance / 2)),
      supply: Math.min(100, Math.round(50 - balance / 2)),
      balance,
      risk: { weather, volatility, oversupply },
      spark,
      market: r.currentPrice,
    };
  });
}

const riskAxes = [
  { subject: "Weather", key: "weather" as const },
  { subject: "Price volatility", key: "volatility" as const },
  { subject: "Oversupply", key: "oversupply" as const },
];

const riskLevelToScore = (level: string) => (level === "Low" ? 22 : level === "Medium" ? 50 : 78);

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
  const cx = size / 2;
  const cy = size / 2;

  // Clamp value so the gauge always stays between 0–100.
  const safeValue = Math.max(0, Math.min(100, value));

  // Left → right across the upper semicircle.
  const startAngle = 180;
  const endAngle = 0;
  const angle = 180 - (safeValue / 100) * 180;

  const toXY = (deg: number): [number, number] => {
    const rad = (deg * Math.PI) / 180;

    return [
      cx + r * Math.cos(rad),
      cy - r * Math.sin(rad),
    ];
  };

  const [x1, y1] = toXY(startAngle);
  const [x2, y2] = toXY(endAngle);
  const [nx, ny] = toXY(angle);

  // Background semicircle.
  const arcPath = `
    M ${x1} ${y1}
    A ${r} ${r} 0 0 1 ${x2} ${y2}
  `;

  // Filled portion based on confidence.
  const valuePath = `
    M ${x1} ${y1}
    A ${r} ${r} 0 0 1 ${nx} ${ny}
  `;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size * 0.62,
      }}
    >
      <svg
        width={size}
        height={size * 0.62}
        viewBox={`0 0 ${size} ${size * 0.62}`}
      >
        <defs>
          <linearGradient
            id="gaugeGrad"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="var(--clay-500)" />
            <stop offset="50%" stopColor="var(--gold-500)" />
            <stop offset="100%" stopColor="var(--forest-600)" />
          </linearGradient>
        </defs>

        {/* Background */}
        <path
          d={arcPath}
          fill="none"
          stroke="rgba(20,49,42,0.08)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Confidence progress */}
        <path
          d={valuePath}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Indicator */}
        <circle
          cx={nx}
          cy={ny}
          r="6.5"
          fill="var(--surface)"
          stroke="var(--forest-700)"
          strokeWidth="2.5"
        />
      </svg>

      <div
        style={{
          position: "absolute",
          top: "58%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 30,
            fontWeight: 600,
            color: "var(--forest-900)",
            lineHeight: 1,
          }}
        >
          {Math.round(safeValue)}%
        </div>

        <div
          style={{
            fontSize: 10.5,
            letterSpacing: "0.06em",
            color: "var(--ink-soft)",
            textTransform: "uppercase",
            marginTop: 3,
          }}
        >
          AI confidence
        </div>
      </div>
    </div>
  );
}

function GlassCard({ children, className = "", style = {}, onClick }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; onClick?: () => void }) {
  return <div className={`glass-card ${className}`} style={style} onClick={onClick}>{children}</div>;
}

function SectionLabel({ eyebrow, title, icon: Icon }: { eyebrow: string; title: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <div className="section-label">
      <div className="section-eyebrow">
        {Icon && <Icon size={13} />} {eyebrow}
      </div>
      <h3>{title}</h3>
    </div>
  );
}

/* No-farm empty state — shown until the user has added and selected a farm */
function NoFarmState() {
  return (
    <div className="dash-root">
      <div className="main-col">
        <GlassCard className="hero" style={{ textAlign: "center", padding: "48px 32px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "var(--sage-100)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 18px",
            }}
          >
            <MapPin size={26} color="var(--forest-600)" />
          </div>
          <h1 className="hero-title" style={{ fontSize: 22 }}>Add a farm to see your dashboard</h1>
          <p className="hero-desc" style={{ maxWidth: 440, margin: "10px auto 22px" }}>
            Recommendations, price forecasts, and risk analysis are generated for a specific
            farm location. Add your first farm to get started.
          </p>
          <button
            type="button"
            className="hero-cta"
            style={{ display: "inline-flex", cursor: "pointer", border: "none" }}
            onClick={() => {
              // Hook this up to whatever opens the "add farm" flow in this app,
              // e.g. router.push('/farms/new') or an "add farm" modal trigger.
              window.dispatchEvent(new CustomEvent('open-add-farm'));
            }}
          >
            <PlusCircle size={14} /> Add your first farm
          </button>
        </GlassCard>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* MAIN DASHBOARD                                                      */
/* ------------------------------------------------------------------ */

export default function Dashboard() {
  const { activeFarm } = useAuth();

  // No fallback to a default location anymore — state/district are only
  // defined once a real farm is active, so nothing fetches or renders
  // until then.
  const state = activeFarm?.state;
  const district = activeFarm?.district;

  const [recommendations, setRecommendations] = useState<Recommendation[] | null>(null);
  const [priceHistory, setPriceHistory] = useState<Forecast[]>([]);
  const [selectedCrop, setSelectedCrop] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refetch whenever the active farm (and therefore state/district) changes
  // — this is what makes the dashboard respond to switching farms. If there
  // is no active farm yet, skip fetching entirely.
  useEffect(() => {
    if (!state || !district) {
      setRecommendations(null);
      setSelectedCrop(null);
      setLoading(false);
      setError(null);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getRecommendations(state, district)
      .then((data) => {
        setRecommendations(data);
        setSelectedCrop(data[0]?.cropId ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [state, district]);

  const crops = useMemo(() => toDashCrops(recommendations ?? []), [recommendations]);

  const top = crops.find((c) => c.id === selectedCrop) ?? crops[0];
  const worst = crops[crops.length - 1];

  // Pull a real price history for the top-ranked commodity so the forecast
  // chart is tied to the active farm's actual top pick, not a fixed mock.
  useEffect(() => {
    if (!top || !state || !district) {
      setPriceHistory([]);
      return;
    }
    // No market name is available from Recommendation data directly; the
    // district's primary mandi conventionally shares its name in this
    // dataset (see mock data), so it's used as a reasonable default.
    getForecastHistory(top.name, state, district, district)
      .then(setPriceHistory)
      .catch(() => setPriceHistory([]));
  }, [top, state, district]);

  const priceForecast = useMemo(
    () =>
      priceHistory.map((h) => ({
        m: new Date(h.date).toLocaleDateString('en-IN', { month: 'short' }),
        actual: h.currentModalPrice,
      })),
    [priceHistory]
  );

  const balanceData = useMemo(() => [...crops].sort((a, b) => b.balance - a.balance), [crops]);

  const radarData = top && worst
    ? riskAxes.map((ax) => ({
        subject: ax.subject,
        [top.name]: riskLevelToScore(top.risk[ax.key]),
        [worst.name]: riskLevelToScore(worst.risk[ax.key]),
      }))
    : [];

  // Nothing to show until a farm exists — render the empty state and stop
  // before touching any farm-scoped data below.
  if (!activeFarm || !state || !district) {
    return <NoFarmState />;
  }

  if (loading) {
    return (
      <div className="dash-root">
        <div className="main-col"><Loading /></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dash-root">
        <div className="main-col"><ErrorView message={error} /></div>
      </div>
    );
  }

  if (!top || !worst) {
    return (
      <div className="dash-root">
        <div className="main-col">
          <GlassCard>
            <p style={{ color: "var(--ink-soft)" }}>
              No recommendations available for {district}, {state} yet.
            </p>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-root">
      {/* MAIN */}
      <div className="main-col">
        {/* HERO RECOMMENDATION */}
        <GlassCard className="hero">
          <div className="hero-grid">
            <div>
              <span className="hero-eyebrow"><Sparkles size={12} /> Top AI recommendation for {district}</span>
              <h1 className="hero-title">Plant <em>{top.name}</em> this season —<br />not {worst.name.toLowerCase()} again.</h1>
              <p className="hero-desc">
                Based on current price trends and market signals for {district}, {state}, {top.name.toLowerCase()} offers
                the strongest risk-adjusted return this cycle among the crops analyzed for your active farm.
              </p>
              <div className="hero-stats">
                <div>
                  <div className="hero-stat-label">Projected profit / acre</div>
                  <div className="hero-stat-value">₹{top.profit.toLocaleString("en-IN")}</div>
                </div>
                <div>
                  <div className="hero-stat-label">Vs. {worst.name.toLowerCase()}</div>
                  <div className="hero-stat-value pos"><ArrowUpRight size={16} style={{ verticalAlign: "-2px" }} /> +{top.profitDelta}%</div>
                </div>
                <div>
                  <div className="hero-stat-label">Demand–supply balance</div>
                  <div className="hero-stat-value pos">{top.balance >= 0 ? "+" : ""}{top.balance}</div>
                </div>
              </div>
              <div className="hero-chips">
                <span className="chip"><TrendingUp size={13} color="var(--forest-600)" /> {top.balance >= 0 ? "Demand rising" : "Watch demand"}</span>
                <span className="chip"><ShieldCheck size={13} color="var(--forest-600)" /> {top.risk.oversupply} oversupply risk</span>
                <span className="chip"><Landmark size={13} color="var(--gold-500)" /> ₹{top.market.toLocaleString("en-IN")}/qtl</span>
                <span className="chip"><CloudRain size={13} color="var(--forest-600)" /> {top.risk.weather} weather risk</span>
              </div>
            </div>

            <div className="hero-divider" />

            <div className="hero-side">
              <div className="hero-gauge-wrap">
                <ConfidenceGauge value={top.confidence} />
                <Link href="/recommendations" className="hero-cta"><ShieldCheck size={14} /> View full reasoning</Link>
              </div>
              <div>
                <div className="compare-row">
                  <span className="compare-name"><top.icon size={14} color="var(--forest-600)" /> {top.name} profit</span>
                  <span className="compare-badge" style={{ color: "var(--forest-600)" }}>₹{top.profit.toLocaleString("en-IN")}</span>
                </div>
                <div className="compare-row">
                  <span className="compare-name"><worst.icon size={14} color="var(--clay-500)" /> {worst.name} profit</span>
                  <span className="compare-badge" style={{ color: "var(--clay-500)" }}>₹{worst.profit.toLocaleString("en-IN")}</span>
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
                  formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${v}`, "Balance"]}
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
            <SectionLabel eyebrow="Price history" title={`${top.name} price trend`} icon={TrendingUp} />
            {priceForecast.length === 0 ? (
              <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>No price history available for {top.name} in {district} yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={priceForecast} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 5" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11.5, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--ink-soft)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--line)", fontSize: 12.5, fontFamily: "var(--font-body)" }} />
                  <Line type="monotone" dataKey="actual" stroke="var(--forest-900)" strokeWidth={2.5} dot={{ r: 3 }} name={`${top.name} price (₹/qtl)`} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
            <div className="legend-row">
              <span><span className="legend-dot" style={{ background: "var(--forest-900)" }} />Modal price</span>
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

        {/* RISK RADAR + MARKET PRICES */}
        <div className="row row-2">
          <GlassCard>
            <SectionLabel eyebrow={`${top.name} vs ${worst.name}`} title="Risk profile" icon={AlertTriangle} />
            <ResponsiveContainer width="100%" height={230}>
              <RadarChart data={radarData} outerRadius={78}>
                <PolarGrid stroke="var(--line)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10.5, fill: "var(--ink-soft)" }} />
                <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                <Radar name={top.name} dataKey={top.name} stroke="var(--forest-600)" fill="var(--forest-600)" fillOpacity={0.28} />
                <Radar name={worst.name} dataKey={worst.name} stroke="var(--clay-500)" fill="var(--clay-500)" fillOpacity={0.18} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="legend-row">
              <span><span className="legend-dot" style={{ background: "var(--forest-600)" }} />{top.name}</span>
              <span><span className="legend-dot" style={{ background: "var(--clay-500)" }} />{worst.name}</span>
            </div>
          </GlassCard>

          <GlassCard>
            <SectionLabel eyebrow="Current mandi prices" title="Market price by crop" icon={Landmark} />
            {crops.slice(0, 5).map((c) => {
              const max = Math.max(...crops.map((x) => x.market), 1) * 1.1;
              return (
                <div className="msp-row" key={c.id}>
                  <span className="msp-name">{c.name}</span>
                  <div className="msp-track">
                    <div className="msp-fill" style={{ width: `${(c.market / max) * 100}%` }} />
                  </div>
                  <span className="msp-value">₹{c.market.toLocaleString("en-IN")}</span>
                </div>
              );
            })}
            <div className="legend-row" style={{ marginTop: 6 }}>
              <span><span className="legend-dot" style={{ background: "var(--gold-500)" }} />Market price (₹/qtl)</span>
            </div>
          </GlassCard>
        </div>

        {/* AI INSIGHTS FEED */}
        <div className="row" style={{ gridTemplateColumns: "1fr" }}>
          <GlassCard>
            <SectionLabel eyebrow="Explainable AI" title="Why these recommendations" icon={Info} />
            <div>
              <div className="insight-item">
                <div className="insight-icon good"><TrendingUp size={16} /></div>
                <div>
                  <div className="insight-title">{top.name} leads for {district}</div>
                  <div className="insight-body">
                    {top.name} scores highest on expected profit and price trend among the crops analyzed
                    for your active farm, with a demand–supply balance of {top.balance >= 0 ? "+" : ""}{top.balance}.
                  </div>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon warn"><AlertTriangle size={16} /></div>
                <div>
                  <div className="insight-title">{worst.name} carries the most risk this cycle</div>
                  <div className="insight-body">
                    {worst.name} shows {worst.risk.oversupply.toLowerCase()} oversupply risk and a
                    demand–supply balance of {worst.balance >= 0 ? "+" : ""}{worst.balance}, the weakest in this comparison.
                  </div>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-icon neutral"><Truck size={16} /></div>
                <div>
                  <div className="insight-title">Switch farms to compare other districts</div>
                  <div className="insight-body">
                    These recommendations are specific to {district}, {state}. Use the farm switcher above to
                    see how the ranking changes for your other farms.
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
