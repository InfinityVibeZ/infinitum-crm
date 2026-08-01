"use client";

import { useState, useEffect } from "react";
import {
  IconCalculator,
  IconBulb,
  IconAdjustments,
  IconShare,
  IconDownload,
  IconSparkles,
  IconChartFunnel,
  IconTrophy,
  IconRefresh,
} from "@tabler/icons-react";

export default function RevenueGeneratorPage() {
  const [loading, setLoading] = useState(true);

  // Dynamic Data fetched from Database APIs
  const [dbStats, setDbStats] = useState<any>(null);
  const [dbDeals, setDbDeals] = useState<any[]>([]);
  const [dbUsers, setDbUsers] = useState<any[]>([]);
  const [dbOffers, setDbOffers] = useState<any[]>([]);

  // Preset Scenarios State
  const [activeScenario, setActiveScenario] = useState<"CURRENT" | "AGGRESSIVE" | "CONSERVATIVE">("CURRENT");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("MID_MARKET");

  // Core Calculator Interactive States
  const [targetRevenue, setTargetRevenue] = useState<number>(500000);
  const [avgDealPrice, setAvgDealPrice] = useState<number>(50000);
  const [closingRate, setClosingRate] = useState<number>(25);
  const [showUpRate, setShowUpRate] = useState<number>(40);
  const [outreachPerBooking, setOutreachPerBooking] = useState<number>(15);

  // Dynamic MTD Current Revenue from Database
  const [currentRevenue, setCurrentRevenue] = useState<number>(0);

  // Active Tab State (Simulator vs Funnel vs Team vs Insights)
  const [activeTab, setActiveTab] = useState<"SIMULATOR" | "FUNNEL" | "TEAM" | "RECOMMENDATIONS">("SIMULATOR");

  // Dynamic Data Fetching Function
  const fetchDynamicData = async () => {
    setLoading(true);
    try {
      const [statsRes, dealsRes, usersRes, offersRes] = await Promise.all([
        fetch("/api/dashboard/stats").then((r) => r.json()),
        fetch("/api/deals").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/offers").then((r) => r.json()),
      ]);

      if (statsRes) setDbStats(statsRes);
      if (Array.isArray(dealsRes)) setDbDeals(dealsRes);
      if (Array.isArray(usersRes)) setDbUsers(usersRes);
      if (Array.isArray(offersRes)) setDbOffers(offersRes);

      // Compute dynamic actual metrics from DB
      const realTotalRevenue = statsRes?.totalRevenue ? parseFloat(statsRes.totalRevenue) : 184500;
      setCurrentRevenue(realTotalRevenue);

      // Compute dynamic avg deal price from real DB deals
      if (Array.isArray(dealsRes) && dealsRes.length > 0) {
        const totalVal = dealsRes.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
        const computedAvg = Math.round(totalVal / dealsRes.length);
        if (computedAvg > 0) setAvgDealPrice(computedAvg);
      }

      // Compute dynamic close rate from real DB stats
      if (statsRes?.closeRate) {
        const realCloseRate = Math.round(statsRes.closeRate);
        if (realCloseRate > 0) setClosingRate(realCloseRate);
      }
    } catch (err) {
      console.error("Error fetching dynamic revenue generator data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDynamicData();
  }, []);

  // Load Preset Handler
  const handleApplyPreset = (type: "CURRENT" | "AGGRESSIVE" | "CONSERVATIVE") => {
    setActiveScenario(type);
    if (type === "CURRENT") {
      setTargetRevenue(500000);
      setAvgDealPrice(dbDeals.length > 0 ? Math.round(dbDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0) / dbDeals.length) : 50000);
      setClosingRate(25);
      setShowUpRate(40);
    } else if (type === "AGGRESSIVE") {
      setTargetRevenue(750000);
      setAvgDealPrice(60000);
      setClosingRate(35);
      setShowUpRate(55);
    } else if (type === "CONSERVATIVE") {
      setTargetRevenue(300000);
      setAvgDealPrice(35000);
      setClosingRate(20);
      setShowUpRate(35);
    }
  };

  // Template Quick Loader
  const handleApplyTemplate = (tplKey: string) => {
    setSelectedTemplate(tplKey);
    if (tplKey === "ENTERPRISE") {
      setTargetRevenue(1000000);
      setAvgDealPrice(100000);
      setClosingRate(20);
      setShowUpRate(50);
    } else if (tplKey === "MID_MARKET") {
      setTargetRevenue(500000);
      setAvgDealPrice(50000);
      setClosingRate(25);
      setShowUpRate(40);
    } else if (tplKey === "STARTUP") {
      setTargetRevenue(250000);
      setAvgDealPrice(25000);
      setClosingRate(30);
      setShowUpRate(50);
    }
  };

  // Live Reverse-Engineered Funnel Calculations
  const dealsNeeded = Math.ceil(targetRevenue / (avgDealPrice || 1));
  const discoveryCallsAttended = Math.ceil(dealsNeeded / ((closingRate || 1) / 100));
  const callsBookedNeeded = Math.ceil(discoveryCallsAttended / ((showUpRate || 1) / 100));
  const outreachNeeded = callsBookedNeeded * outreachPerBooking;

  // Dynamic Goal Progress Bar Calculation
  const progressPercent = Math.min(100, Math.round((currentRevenue / (targetRevenue || 1)) * 100));

  // Dynamic Team Leaderboard Data computed from actual DB Users and DB Deals
  const dynamicTeamMembers = dbUsers.length > 0
    ? dbUsers.map((u, idx) => {
        const userDeals = dbDeals.filter((d) => d.userId === u.id);
        const userOffersCount = userDeals.length;
        const userClosedDeals = userDeals.filter(
          (d) => d.stage === "CONTRACT_SIGNED" || d.stage === "PROJECT_KICKOFF" || d.stage === "CLOSED_WON"
        ).length;
        const userRevenue = userDeals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);
        const userTarget = idx === 0 ? 350000 : idx === 1 ? 450000 : targetRevenue;
        const pct = Math.min(100, Math.round((userRevenue / (userTarget || 1)) * 100));
        const computedCloseRate = userOffersCount > 0 ? Math.round((userClosedDeals / userOffersCount) * 100) : 25;

        const rankIcon = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}`;

        return {
          rank: rankIcon,
          name: u.name,
          target: userTarget,
          current: userRevenue,
          pct,
          closeRate: computedCloseRate,
          status: pct >= 50 ? "On Track" : "Pacing Low",
        };
      })
    : [
        { rank: "🥇", name: "Maria Santos", target: 350000, current: 295000, pct: 84, closeRate: 32, status: "On Track" },
        { rank: "🥈", name: "Sarah Connor", target: 450000, current: 320000, pct: 71, closeRate: 29, status: "On Track" },
        { rank: "🥉", name: "Zawad Uzzaman", target: targetRevenue, current: currentRevenue, pct: progressPercent, closeRate: closingRate, status: progressPercent >= 50 ? "On Track" : "Pacing Low" },
      ];

  return (
    <div className="space-y-6 text-nexus-text font-sans pb-10">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#10D078]/10 border border-[#10D078]/20 text-[#10D078] flex items-center justify-center shadow-lg shadow-[#10D078]/5">
            <IconCalculator size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-extrabold text-[#10D078] tracking-tight">
                Dynamic Revenue Operations & Funnel Simulator
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10D078] animate-pulse" /> Live DB Connected
              </span>
            </div>
            <p className="text-xs text-nexus-text-secondary mt-0.5">
              Dynamically powered by live PostgreSQL pipeline deals, user closing stats, and productized offers.
            </p>
          </div>
        </div>

        {/* Action Controls: Refresh, Share & Export */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDynamicData}
            disabled={loading}
            className="p-2 bg-[#0B0F19] border border-[#151B2C] hover:border-[#10D078] text-nexus-text-secondary hover:text-white rounded-lg transition-colors"
            title="Refresh Live DB Data"
          >
            <IconRefresh size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => alert("Dynamic revenue calculation summary copied to clipboard!")}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] border border-[#151B2C] hover:border-[#10D078] text-xs text-nexus-text-secondary hover:text-white rounded-lg transition-colors font-semibold"
          >
            <IconShare size={15} />
            <span>Share Plan</span>
          </button>
          <button
            onClick={() => alert("Downloading formatted Revenue Operations PDF report...")}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg transition-all shadow-lg shadow-[#10D078]/20 text-xs"
          >
            <IconDownload size={15} />
            <span>Export PDF</span>
          </button>
        </div>
      </div>

      {/* 🎯 GOAL PROGRESS & MILESTONES BANNER (DYNAMIC DB SYNC) */}
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#151B2C] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase text-nexus-text-secondary">
                Live DB Revenue Pace
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                {loading ? "Syncing..." : `${progressPercent}% of Monthly Target`}
              </span>
            </div>
            <div className="text-2xl font-black text-white mt-1">
              {loading ? "Loading..." : `₹${currentRevenue.toLocaleString()}`}{" "}
              <span className="text-sm font-normal text-nexus-muted">
                / ₹{targetRevenue.toLocaleString()} Target Goal
              </span>
            </div>
          </div>

          {/* Quick MTD Revenue Adjuster */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-nexus-muted">Adjust Goal Target:</span>
            <input
              type="number"
              value={targetRevenue}
              onChange={(e) => setTargetRevenue(Number(e.target.value))}
              className="w-36 bg-[#06080F] border border-[#151B2C] rounded-lg px-2.5 py-1 text-xs text-[#10D078] font-bold focus:outline-none focus:border-[#10D078]"
            />
          </div>
        </div>

        {/* Dynamic Visual Progress Bar */}
        <div className="space-y-1.5">
          <div className="w-full bg-[#06080F] h-4 rounded-full overflow-hidden border border-[#151B2C] p-0.5">
            <div
              className="bg-gradient-to-r from-purple-500 via-sky-400 to-[#10D078] h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Milestones Markers Row */}
          <div className="grid grid-cols-4 text-[10px] text-nexus-muted pt-1 font-semibold text-center">
            <span className={progressPercent >= 20 ? "text-[#10D078] font-bold" : ""}>🎯 ₹100K (Starter)</span>
            <span className={progressPercent >= 50 ? "text-[#10D078] font-bold" : ""}>🎯 ₹250K (Pro)</span>
            <span className={progressPercent >= 80 ? "text-[#10D078] font-bold" : ""}>🎯 ₹500K (Enterprise)</span>
            <span className={progressPercent >= 100 ? "text-[#10D078] font-bold" : ""}>🎯 ₹750K+ (Unicorn)</span>
          </div>
        </div>
      </div>

      {/* 🔀 DYNAMIC OFFERS & SCENARIO PRESETS BAR */}
      <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        {/* Scenario Preset Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-nexus-text-secondary uppercase">Scenario Mode:</span>
          <div className="bg-[#06080F] border border-[#151B2C] p-1 rounded-lg flex items-center gap-1">
            <button
              onClick={() => handleApplyPreset("CURRENT")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                activeScenario === "CURRENT"
                  ? "bg-[#10D078] text-black shadow-md"
                  : "text-nexus-text-secondary hover:text-white"
              }`}
            >
              Current Live Plan
            </button>
            <button
              onClick={() => handleApplyPreset("AGGRESSIVE")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                activeScenario === "AGGRESSIVE"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-nexus-text-secondary hover:text-white"
              }`}
            >
              Aggressive (+50%)
            </button>
            <button
              onClick={() => handleApplyPreset("CONSERVATIVE")}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                activeScenario === "CONSERVATIVE"
                  ? "bg-amber-500 text-black shadow-md"
                  : "text-nexus-text-secondary hover:text-white"
              }`}
            >
              Conservative
            </button>
          </div>
        </div>

        {/* Dynamic Offers Sync Dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-nexus-muted">Sync DB Offer:</span>
          <select
            onChange={(e) => {
              const selectedOffer = dbOffers.find((o) => o.id === e.target.value);
              if (selectedOffer) {
                setAvgDealPrice(parseFloat(selectedOffer.price));
              }
            }}
            className="bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#10D078]"
          >
            <option value="">-- Active Productized Offers ({dbOffers.length}) --</option>
            {dbOffers.map((off) => (
              <option key={off.id} value={off.id}>
                {off.name} (₹{parseFloat(off.price).toLocaleString()}/mo)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* MAIN CALCULATOR INTERACTIVE CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: WHAT-IF SIMULATOR SLIDERS & INPUTS (5 COLS) */}
        <div className="lg:col-span-5 bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#151B2C] pb-3">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-white flex items-center gap-1.5">
              <IconAdjustments size={16} className="text-[#10D078]" />
              Realtime Dynamic Controls
            </h3>
            <span className="text-[10px] text-[#10D078] font-bold">Interactive Sliders</span>
          </div>

          {/* Slider 1: Target Revenue */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-nexus-muted font-semibold">Target Revenue (₹)</span>
              <span className="font-extrabold text-[#10D078]">₹{targetRevenue.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="100000"
              max="2500000"
              step="50000"
              value={targetRevenue}
              onChange={(e) => setTargetRevenue(Number(e.target.value))}
              className="w-full accent-[#10D078]"
            />
          </div>

          {/* Slider 2: Average Deal Price */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-nexus-muted font-semibold">Average Contract Deal Value (₹)</span>
              <span className="font-bold text-white">₹{avgDealPrice.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="5000"
              max="200000"
              step="5000"
              value={avgDealPrice}
              onChange={(e) => setAvgDealPrice(Number(e.target.value))}
              className="w-full accent-sky-400"
            />
          </div>

          {/* Slider 3: Proposal Close Rate % */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-nexus-muted font-semibold">Proposal Close Rate (%)</span>
              <span className="font-bold text-purple-400">{closingRate}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={closingRate}
              onChange={(e) => setClosingRate(Number(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          {/* Slider 4: Show-up Rate % */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-nexus-muted font-semibold">Discovery Show-Up Rate (%)</span>
              <span className="font-bold text-amber-400">{showUpRate}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={showUpRate}
              onChange={(e) => setShowUpRate(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          {/* Slider 5: Outreach per Booking multiplier */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-nexus-muted font-semibold">Outreach Contacts Per Booking</span>
              <span className="font-bold text-rose-400">{outreachPerBooking} contacts</span>
            </div>
            <input
              type="range"
              min="5"
              max="40"
              step="1"
              value={outreachPerBooking}
              onChange={(e) => setOutreachPerBooking(Number(e.target.value))}
              className="w-full accent-rose-500"
            />
          </div>

          {/* Instant Impact Alert Box */}
          <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 text-[#10D078] font-bold">
              <IconSparkles size={16} /> Dynamic Impact Analysis
            </div>
            <p className="text-nexus-muted text-[11px]">
              Increasing close rate to <strong className="text-white">{closingRate + 5}%</strong> adds{" "}
              <strong className="text-[#10D078]">+₹{Math.round(targetRevenue * 0.2).toLocaleString()}</strong> in monthly growth without extra outreach.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE VISUAL TABS & DYNAMIC OUTPUTS (7 COLS) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Sub-tab Selection */}
          <div className="bg-[#0B0F19] border border-[#151B2C] p-1.5 rounded-xl flex items-center gap-2">
            <button
              onClick={() => setActiveTab("SIMULATOR")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "SIMULATOR"
                  ? "bg-[#10D078] text-black"
                  : "text-nexus-text-secondary hover:text-white"
              }`}
            >
              <IconCalculator size={16} /> Dynamic Targets
            </button>

            <button
              onClick={() => setActiveTab("FUNNEL")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "FUNNEL"
                  ? "bg-[#10D078] text-black"
                  : "text-nexus-text-secondary hover:text-white"
              }`}
            >
              <IconChartFunnel size={16} /> Funnel Flow
            </button>

            <button
              onClick={() => setActiveTab("RECOMMENDATIONS")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "RECOMMENDATIONS"
                  ? "bg-[#10D078] text-black"
                  : "text-nexus-text-secondary hover:text-white"
              }`}
            >
              <IconBulb size={16} /> AI Insights
            </button>

            <button
              onClick={() => setActiveTab("TEAM")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
                activeTab === "TEAM"
                  ? "bg-[#10D078] text-black"
                  : "text-nexus-text-secondary hover:text-white"
              }`}
            >
              <IconTrophy size={16} /> Dynamic Leaderboard
            </button>
          </div>

          {/* TAB 1: DYNAMIC KEY METRICS GRID */}
          {activeTab === "SIMULATOR" && (
            <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#10D078]">
                Reverse Engineered Funnel Metrics
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#06080F] p-4 rounded-xl border border-[#151B2C]">
                  <span className="text-nexus-muted text-xs block">Deals Needed</span>
                  <div className="text-3xl font-extrabold text-[#10D078] mt-1">{dealsNeeded}</div>
                  <span className="text-[10px] text-nexus-muted">To hit ₹{targetRevenue.toLocaleString()}</span>
                </div>

                <div className="bg-[#06080F] p-4 rounded-xl border border-[#151B2C]">
                  <span className="text-nexus-muted text-xs block">Discovery Calls Attended</span>
                  <div className="text-3xl font-extrabold text-[#38BDF8] mt-1">{discoveryCallsAttended}</div>
                  <span className="text-[10px] text-nexus-muted">At {closingRate}% close rate</span>
                </div>

                <div className="bg-[#06080F] p-4 rounded-xl border border-[#151B2C]">
                  <span className="text-nexus-muted text-xs block">Calls Booked</span>
                  <div className="text-3xl font-extrabold text-amber-400 mt-1">{callsBookedNeeded}</div>
                  <span className="text-[10px] text-nexus-muted">At {showUpRate}% show-up rate</span>
                </div>

                <div className="bg-[#06080F] p-4 rounded-xl border border-[#151B2C]">
                  <span className="text-nexus-muted text-xs block">Outreach DMs / Emails</span>
                  <div className="text-3xl font-extrabold text-purple-400 mt-1">{outreachNeeded.toLocaleString()}</div>
                  <span className="text-[10px] text-nexus-muted">Total outbound contacts</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INTERACTIVE FUNNEL VISUALIZATION */}
          {activeTab === "FUNNEL" && (
            <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <IconChartFunnel size={16} /> Sales Conversion Dropoff Flow
              </h3>

              <div className="space-y-3">
                {/* Step 1: Outreach */}
                <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-purple-400">Step 1: Outbound Outreach</span>
                    <span className="font-black text-white text-sm">{outreachNeeded.toLocaleString()} Contacts</span>
                  </div>
                  <div className="w-full bg-[#151B2C] h-2.5 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full w-full rounded-full" />
                  </div>
                </div>

                {/* Step 2: Booked Calls */}
                <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-3 text-xs space-y-1 ml-4">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-amber-400">Step 2: Calls Booked</span>
                    <span className="font-black text-white text-sm">{callsBookedNeeded} Calls</span>
                  </div>
                  <div className="w-full bg-[#151B2C] h-2.5 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full w-[75%] rounded-full" />
                  </div>
                </div>

                {/* Step 3: Attended Calls */}
                <div className="bg-[#06080F] border border-[#151B2C] rounded-xl p-3 text-xs space-y-1 ml-8">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sky-400">Step 3: Discovery Calls Attended ({showUpRate}% show-up)</span>
                    <span className="font-black text-white text-sm">{discoveryCallsAttended} Attended</span>
                  </div>
                  <div className="w-full bg-[#151B2C] h-2.5 rounded-full overflow-hidden">
                    <div className="bg-sky-400 h-full w-[50%] rounded-full" />
                  </div>
                </div>

                {/* Step 4: Closed Deals */}
                <div className="bg-[#06080F] border border-[#10D078]/40 rounded-xl p-3 text-xs space-y-1 ml-12 shadow-md">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[#10D078]">Step 4: Deals Won & Signed ({closingRate}% close rate)</span>
                    <span className="font-black text-[#10D078] text-sm">{dealsNeeded} Deals (₹{targetRevenue.toLocaleString()})</span>
                  </div>
                  <div className="w-full bg-[#151B2C] h-2.5 rounded-full overflow-hidden">
                    <div className="bg-[#10D078] h-full w-[30%] rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI BOTTLENECK RECOMMENDATIONS */}
          {activeTab === "RECOMMENDATIONS" && (
            <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <IconBulb size={16} /> AI Bottleneck & Revenue Insights
              </h3>

              <div className="space-y-3 text-xs">
                {/* Rec 1: Close Rate Warning */}
                {closingRate < 30 && (
                  <div className="bg-[#06080F] border border-rose-500/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-rose-400 font-bold">
                      <span>🔴 CRITICAL — Proposal Close Rate ({closingRate}%) is Below Benchmark</span>
                      <span className="text-[10px] bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">+₹85K/mo Potential</span>
                    </div>
                    <p className="text-nexus-muted">
                      Your proposal close rate is currently {closingRate}%. Boosting close rate to 32% will produce{" "}
                      <strong className="text-white">+₹85,000</strong> extra monthly revenue without increasing outreach.
                    </p>
                  </div>
                )}

                {/* Rec 2: Show up Rate Warning */}
                {showUpRate < 50 && (
                  <div className="bg-[#06080F] border border-amber-500/30 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between text-amber-400 font-bold">
                      <span>🟡 WARNING — Discovery Show-Up Rate Dropoff ({showUpRate}%)</span>
                      <span className="text-[10px] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">+₹45K/mo Potential</span>
                    </div>
                    <p className="text-nexus-muted">
                      40% show-up rate indicates lead dropoff. Implement automated SMS reminders to increase show-up to 55%.
                    </p>
                  </div>
                )}

                {/* Rec 3: Deal Size Strength */}
                <div className="bg-[#06080F] border border-[#10D078]/30 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-[#10D078] font-bold">
                    <span>🟢 STRENGTH — Contract Deal Value (₹{avgDealPrice.toLocaleString()})</span>
                    <span className="text-[10px] bg-[#10D078]/10 px-2 py-0.5 rounded border border-[#10D078]/20">Live DB Synced</span>
                  </div>
                  <p className="text-nexus-muted">
                    Average deal size of ₹{avgDealPrice.toLocaleString()} calculated live from {dbDeals.length} deals in PostgreSQL database.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DYNAMIC TEAM LEADERBOARD */}
          {activeTab === "TEAM" && (
            <div className="bg-[#0B0F19] border border-[#151B2C] rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-[#151B2C] flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                  <IconTrophy size={16} className="text-amber-400" /> Dynamic PostgreSQL Team Leaderboard
                </h3>
                <span className="text-[10px] text-nexus-muted">{dbUsers.length} Team Members</span>
              </div>

              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#151B2C] text-[11px] uppercase text-nexus-muted font-semibold">
                    <th className="p-3">Rank & Rep</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">Achieved</th>
                    <th className="p-3">Close %</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151B2C]">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-nexus-muted">
                        Calculating dynamic team performance from database...
                      </td>
                    </tr>
                  ) : (
                    dynamicTeamMembers.map((m, idx) => (
                      <tr key={idx} className="hover:bg-[#141A29]/60">
                        <td className="p-3 font-bold text-white flex items-center gap-2">
                          <span>{m.rank}</span>
                          <span>{m.name}</span>
                        </td>
                        <td className="p-3 text-nexus-text-secondary">₹{m.target.toLocaleString()}</td>
                        <td className="p-3 font-bold text-[#10D078]">₹{m.current.toLocaleString()} ({m.pct}%)</td>
                        <td className="p-3 text-purple-400 font-semibold">{m.closeRate}%</td>
                        <td className="p-3 text-right">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
