import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, BarChart, Bar, Cell, ReferenceLine, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend, LineChart,
} from "recharts";
import {
  Sprout, Wheat, Leaf, TrendingUp, TrendingDown, CloudRain, AlertTriangle,
  ShieldCheck, Search, Bell, ChevronDown, ArrowUpRight, ArrowDownRight,
  Info, Landmark, Truck, Droplets, Sparkles, LayoutGrid, LineChart as LineChartIcon,
  CloudSun, FileText, Settings, MapPin, ArrowRight, CircleCheck, Gauge,
} from "lucide-react";

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
    icon: CloudSun,
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

const riskColor = (level) =>
  level === "Low" ? "var(--forest-600)" : level === "Medium" ? "var(--gold-500)" : "var(--clay-500)";
const riskBg = (level) =>
  level === "Low" ? "var(--sage-100)" : level === "Medium" ? "var(--gold-100)" : "var(--clay-100)";

function RiskPill({ level }) {
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

function Sparkline({ data, positive }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={points} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <Line
          type="monotone" dataKey="v" stroke={positive ? "var(--forest-600)" : "var(--clay-500)"}
          strokeWidth={2} dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* Semi-circle "AI confidence" gauge — the signature visual */
function ConfidenceGauge({ value = 87, size = 168 }) {
  const r = size / 2 - 14;
  const cx = size / 2, cy = size / 2;
  const startAngle = 180, endAngle = 0;
  const angle = 180 - (value / 100) * 180;
  const toXY = (deg) => {
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

function GlassCard({ children, className = "", style = {} }) {
  return <div className={`glass-card ${className}`} style={style}>{children}</div>;
}

function SectionLabel({ eyebrow, title, icon: Icon }) {
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
  const [season, setSeason] = useState("Rabi 2026");
  const [selectedCrop, setSelectedCrop] = useState("soybean");
  const top = crops.find((c) => c.id === "soybean");
  const wheat = crops.find((c) => c.id === "wheat");
  const active = crops.find((c) => c.id === selectedCrop) || top;

  const balanceData = useMemo(
    () => [...crops].sort((a, b) => b.balance - a.balance).map((c) => ({ ...c })),
    []
  );

  const radarData = riskAxes.map((ax) => ({
    subject: ax.subject,
    Soybean: riskValues.soybean[ax.key],
    Wheat: riskValues.wheat[ax.key],
  }));

  const navItems = [
    { icon: LayoutGrid, label: "Dashboard", active: true },
    { icon: Sprout, label: "Crop recommendations" },
    { icon: LineChartIcon, label: "Market trends" },
    { icon: CloudSun, label: "Weather & risk" },
    { icon: FileText, label: "Reports" },
    { icon: Settings, label: "Settings" },
  ];

  return (
    <div className="dash-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

        .dash-root {
          --canvas: #F7F6F0;
          --surface: #FFFFFF;
          --forest-900: #14312A;
          --forest-700: #1E4A38;
          --forest-600: #2E6B4E;
          --sage-300: #B7CBB0;
          --sage-100: #E7EFE2;
          --gold-500: #C4963A;
          --gold-100: #F5EAD2;
          --clay-500: #AE6A44;
          --clay-100: #F1E1D4;
          --ink: #1B221D;
          --ink-soft: #5B685E;
          --line: rgba(20,49,42,0.09);
          --font-display: 'Fraunces', serif;
          --font-body: 'Inter', sans-serif;
          --font-mono: 'IBM Plex Mono', monospace;

          font-family: var(--font-body);
          color: var(--ink);
          background:
            radial-gradient(1100px 520px at 88% -8%, rgba(196,150,58,0.14), transparent 60%),
            radial-gradient(900px 480px at -8% 8%, rgba(46,107,78,0.12), transparent 55%),
            var(--canvas);
          min-height: 100vh;
          display: flex;
          -webkit-font-smoothing: antialiased;
        }
        .dash-root * { box-sizing: border-box; }
        .dash-root ::selection { background: var(--sage-300); }

        /* ---------- Sidebar ---------- */
        .sidebar {
          width: 76px; flex-shrink: 0; min-height: 100vh;
          display: flex; flex-direction: column; align-items: center;
          padding: 22px 0; gap: 30px;
          background: linear-gradient(180deg, var(--forest-900), #0F241D);
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        .brand-mark {
          width: 38px; height: 38px; border-radius: 11px;
          background: linear-gradient(135deg, var(--gold-500), var(--forest-600));
          display: flex; align-items: center; justify-content: center;
          color: #fff; box-shadow: 0 6px 18px rgba(196,150,58,0.35);
        }
        .side-nav { display: flex; flex-direction: column; gap: 6px; width: 100%; align-items: center; }
        .side-item {
          width: 44px; height: 44px; border-radius: 12px; display: flex;
          align-items: center; justify-content: center; color: rgba(231,239,226,0.55);
          cursor: pointer; transition: all .15s ease; position: relative;
        }
        .side-item:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .side-item.active { color: var(--forest-900); background: var(--sage-300); }
        .side-item.active::before {
          content: ""; position: absolute; left: -12px; width: 4px; height: 18px;
          border-radius: 3px; background: var(--gold-500);
        }

        /* ---------- Main column ---------- */
        .main-col { flex: 1; min-width: 0; padding: 0 40px 56px; }

        .topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 24px 0 20px; position: sticky; top: 0; z-index: 5;
        }
        .topbar-left { display: flex; align-items: center; gap: 14px; }
        .brand-name { font-family: var(--font-display); font-size: 20px; font-weight: 600; letter-spacing: -0.01em; }
        .brand-sub { font-size: 11.5px; color: var(--ink-soft); letter-spacing: 0.04em; }
        .selector {
          display: flex; align-items: center; gap: 6px; padding: 8px 12px;
          background: rgba(255,255,255,0.6); border: 1px solid var(--line); border-radius: 10px;
          font-size: 13px; font-weight: 500; cursor: pointer; backdrop-filter: blur(6px);
        }
        .selector:hover { border-color: var(--sage-300); }
        .topbar-right { display: flex; align-items: center; gap: 14px; }
        .icon-btn {
          width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center;
          justify-content: center; background: rgba(255,255,255,0.6); border: 1px solid var(--line);
          color: var(--forest-900); cursor: pointer;
        }
        .search-box {
          display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 10px;
          background: rgba(255,255,255,0.6); border: 1px solid var(--line); color: var(--ink-soft); font-size: 13px;
          width: 200px;
        }
        .avatar {
          width: 38px; height: 38px; border-radius: 10px; background: linear-gradient(135deg, var(--forest-600), var(--forest-900));
          color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600;
          font-family: var(--font-mono);
        }

        .glass-card {
          background: linear-gradient(160deg, rgba(255,255,255,0.82), rgba(255,255,255,0.55));
          border: 1px solid rgba(255,255,255,0.7);
          border-radius: 18px;
          box-shadow: 0 1px 2px rgba(20,49,42,0.04), 0 16px 40px -20px rgba(20,49,42,0.22);
          backdrop-filter: blur(14px);
          padding: 22px;
        }

        /* ---------- Hero ---------- */
        .hero {
          position: relative; overflow: hidden; padding: 30px 32px;
          background:
            radial-gradient(520px 260px at 82% 0%, rgba(196,150,58,0.16), transparent 65%),
            linear-gradient(155deg, rgba(255,255,255,0.88), rgba(231,239,226,0.55));
        }
        .hero::after {
          content: ""; position: absolute; inset: 0; opacity: 0.5; pointer-events: none;
          background-image:
            repeating-radial-gradient(circle at 88% 12%, transparent 0, transparent 16px, rgba(20,49,42,0.05) 17px, transparent 18px);
          background-size: 340px 340px;
        }
        .hero-grid { display: grid; grid-template-columns: 1.5fr auto 1.1fr; gap: 32px; position: relative; z-index: 1; }
        .hero-eyebrow {
          display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.08em; color: var(--forest-600);
          background: var(--sage-100); border: 1px solid var(--sage-300); padding: 5px 10px; border-radius: 100px;
        }
        .hero-title {
          font-family: var(--font-display); font-size: 40px; line-height: 1.06; letter-spacing: -0.015em;
          margin: 14px 0 8px; color: var(--forest-900);
        }
        .hero-title em { font-style: normal; color: var(--forest-600); }
        .hero-desc { font-size: 14.5px; color: var(--ink-soft); max-width: 46ch; line-height: 1.55; margin-bottom: 18px; }
        .hero-stats { display: flex; gap: 26px; margin-top: 6px; }
        .hero-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-soft); margin-bottom: 3px; }
        .hero-stat-value { font-family: var(--font-mono); font-size: 21px; font-weight: 600; color: var(--forest-900); }
        .hero-stat-value.pos { color: var(--forest-600); }
        .hero-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
        .chip {
          display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500;
          padding: 6px 11px; border-radius: 100px; background: rgba(255,255,255,0.75);
          border: 1px solid var(--line); color: var(--forest-900);
        }
        .hero-divider { width: 1px; background: linear-gradient(180deg, transparent, var(--line), transparent); }
        .hero-gauge-wrap { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
        .hero-cta {
          display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600;
          color: var(--forest-900); background: var(--gold-100); border: 1px solid var(--gold-500);
          padding: 8px 14px; border-radius: 10px; cursor: pointer;
        }
        .hero-side { display: flex; flex-direction: column; justify-content: center; gap: 14px; }
        .compare-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed var(--line); }
        .compare-row:last-child { border-bottom: none; }
        .compare-name { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 500; }
        .compare-badge { font-family: var(--font-mono); font-size: 13.5px; font-weight: 600; }

        /* ---------- Grid layout ---------- */
        .row { display: grid; gap: 20px; margin-top: 20px; }
        .row-2 { grid-template-columns: 1.35fr 1fr; }
        .row-3 { grid-template-columns: 1fr 1fr 1fr; }

        .section-label { display: flex; flex-direction: column; gap: 3px; margin-bottom: 14px; }
        .section-eyebrow {
          display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600;
          letter-spacing: 0.07em; text-transform: uppercase; color: var(--forest-600);
        }
        .section-label h3 { margin: 0; font-family: var(--font-display); font-size: 19px; font-weight: 500; color: var(--forest-900); }

        .legend-row { display: flex; gap: 16px; font-size: 12px; color: var(--ink-soft); }
        .legend-dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; margin-right: 5px; }

        /* ---------- Crop grid ---------- */
        .crop-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px; }
        .crop-card {
          padding: 18px; cursor: pointer; transition: transform .15s ease, box-shadow .15s ease; position: relative;
        }
        .crop-card:hover { transform: translateY(-2px); }
        .crop-card.selected { outline: 2px solid var(--forest-600); outline-offset: -2px; }
        .crop-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .crop-icon { width: 34px; height: 34px; border-radius: 9px; background: var(--sage-100); color: var(--forest-600); display: flex; align-items: center; justify-content: center; }
        .rec-badge {
          font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
          color: #fff; background: var(--forest-600); padding: 3px 8px; border-radius: 100px;
        }
        .crop-name { font-size: 15px; font-weight: 600; color: var(--forest-900); margin-bottom: 2px; }
        .crop-profit { font-family: var(--font-mono); font-size: 22px; font-weight: 600; color: var(--forest-900); }
        .crop-profit-sub { font-size: 11.5px; color: var(--ink-soft); margin-bottom: 10px; }
        .crop-delta { display: inline-flex; align-items: center; gap: 3px; font-size: 12.5px; font-weight: 600; }
        .crop-delta.up { color: var(--forest-600); }
        .crop-delta.down { color: var(--clay-500); }
        .crop-meta-row { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
        .conf-bar-track { flex: 1; height: 5px; border-radius: 3px; background: var(--sage-100); margin-right: 10px; overflow: hidden; }
        .conf-bar-fill { height: 100%; border-radius: 3px; background: linear-gradient(90deg, var(--gold-500), var(--forest-600)); }
        .conf-label { font-size: 11px; color: var(--ink-soft); font-family: var(--font-mono); white-space: nowrap; }

        .risk-pill {
          display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600;
          padding: 3px 9px; border-radius: 100px; border: 1px solid;
        }
        .risk-dot { width: 6px; height: 6px; border-radius: 50%; }

        /* ---------- Insights feed ---------- */
        .insight-item { display: flex; gap: 12px; padding: 13px 0; border-bottom: 1px solid var(--line); }
        .insight-item:last-child { border-bottom: none; }
        .insight-icon { width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .insight-icon.good { background: var(--sage-100); color: var(--forest-600); }
        .insight-icon.warn { background: var(--clay-100); color: var(--clay-500); }
        .insight-icon.neutral { background: var(--gold-100); color: var(--gold-500); }
        .insight-title { font-size: 13.5px; font-weight: 600; color: var(--forest-900); margin-bottom: 2px; }
        .insight-body { font-size: 12.5px; color: var(--ink-soft); line-height: 1.5; }

        /* ---------- Procurement panel ---------- */
        .msp-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; }
        .msp-name { width: 92px; font-size: 12.5px; font-weight: 500; flex-shrink: 0; }
        .msp-track { flex: 1; height: 8px; border-radius: 4px; background: var(--sage-100); position: relative; overflow: visible; }
        .msp-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, var(--forest-600), var(--gold-500)); }
        .msp-marker { position: absolute; top: -3px; width: 2px; height: 14px; background: var(--forest-900); }
        .msp-value { width: 68px; text-align: right; font-family: var(--font-mono); font-size: 12px; color: var(--ink-soft); flex-shrink: 0; }

        .kpi-strip { display: flex; gap: 14px; }
        .kpi-pill { flex: 1; padding: 14px; border-radius: 14px; background: rgba(255,255,255,0.55); border: 1px solid var(--line); }
        .kpi-pill-label { font-size: 11px; color: var(--ink-soft); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
        .kpi-pill-value { font-family: var(--font-mono); font-size: 18px; font-weight: 600; color: var(--forest-900); }

        @media (max-width: 1180px) {
          .row-2, .row-3, .crop-grid { grid-template-columns: 1fr; }
          .hero-grid { grid-template-columns: 1fr; }
          .hero-divider { display: none; }
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand-mark"><Sprout size={20} /></div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <div key={item.label} className={`side-item ${item.active ? "active" : ""}`} title={item.label}>
              <item.icon size={19} strokeWidth={1.9} />
            </div>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <div className="main-col">
        {/* TOPBAR */}
        <div className="topbar">
          <div className="topbar-left">
            <div>
              <div className="brand-name">YieldAI</div>
              <div className="brand-sub">Intelligent crop forecasting</div>
            </div>
            <div className="selector"><MapPin size={14} /> Nashik, MH <ChevronDown size={14} /></div>
            <div className="selector" onClick={() => setSeason(season === "Rabi 2026" ? "Kharif 2026" : "Rabi 2026")}>
              <CloudSun size={14} /> {season} <ChevronDown size={14} />
            </div>
          </div>
          <div className="topbar-right">
            <div className="search-box"><Search size={14} /> Search crops, mandis…</div>
            <div className="icon-btn"><Bell size={16} /></div>
            <div className="avatar">RP</div>
          </div>
        </div>

        {/* HERO RECOMMENDATION */}
        <GlassCard className="hero">
          <div className="hero-grid">
            <div>
              <span className="hero-eyebrow"><Sparkles size={12} /> Top AI recommendation · {season}</span>
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
                  formatter={(v) => [`${v > 0 ? "+" : ""}${v}`, "Balance"]}
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
            <SectionLabel eyebrow="12-week outlook" title="Soybean price forecast" icon={LineChartIcon} />
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
        <SectionLabel eyebrow="Ranked by AI" title="Crop opportunity comparison" icon={LayoutGrid} />
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
                    <div className="msp-marker" style={{ left: `${(c.msp / max) * 100}%` }} title="MSP" />
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
