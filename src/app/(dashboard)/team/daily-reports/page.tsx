"use client";

import { useState, useEffect } from "react";
import {
  IconUsers,
  IconSend,
  IconAlertTriangle,
  IconTrophy,
  IconSparkles,
} from "@tabler/icons-react";
import Link from "next/link";

export default function DailyReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [repName, setRepName] = useState("Zawad Uzzaman");
  const [role, setRole] = useState("Setter");
  const [outreachSent, setOutreachSent] = useState("50");
  const [callsBooked, setCallsBooked] = useState("3");
  const [wins, setWins] = useState("");
  const [blockers, setBlockers] = useState("");

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/team/daily-reports");
      const data = await res.json();
      if (Array.isArray(data)) {
        setReports(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/team/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repName,
          role,
          outreachSent,
          callsBooked,
          wins,
          blockers,
        }),
      });

      if (res.ok) {
        setWins("");
        setBlockers("");
        fetchReports();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const smartAlerts = [
    { id: "1", type: "CRITICAL", text: "John's call volume ↓50% vs last week (15 calls vs avg 32)", time: "10 mins ago" },
    { id: "2", type: "WARNING", text: "Maria blocked on contract e-signature verification with Lmnopq Corp", time: "1 hour ago" },
    { id: "3", type: "INFO", text: "Tim is pacing at 60% of monthly quota — requires manager assistance", time: "2 hours ago" },
  ];

  return (
    <div className="space-y-6 text-nexus-text font-sans">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="p-2 bg-[#10D078]/10 rounded-xl text-[#10D078]">
              <IconUsers size={24} />
            </span>
            Daily Team Reports (EOD)
          </h1>
          <p className="text-xs text-nexus-text-secondary mt-1">
            Submit and track daily End-of-Day output, calls booked, revenue closed, and team blockers.
          </p>
        </div>

        {/* Quick Action Navigation Sub-tabs */}
        <div className="flex items-center gap-2">
          <Link
            href="/team/daily-reports/leaderboard"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#0B0F19] hover:bg-[#141A29] border border-[#151B2C] text-xs font-semibold rounded-lg transition-colors text-amber-400"
          >
            <IconTrophy size={16} />
            <span>Leaderboard</span>
          </Link>
          <Link
            href="/team/daily-reports/briefing"
            className="flex items-center gap-1.5 px-3 py-2 bg-[#10D078]/10 border border-[#10D078]/30 hover:bg-[#10D078]/20 text-xs font-semibold rounded-lg transition-colors text-[#10D078]"
          >
            <IconSparkles size={16} />
            <span>AI Team Briefing</span>
          </Link>
        </div>
      </div>

      {/* 1. Smart Alerts Section (#alerts) */}
      <div id="alerts" className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-[#151B2C] pb-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <IconAlertTriangle size={18} />
            <span>Smart Alerts & Anomaly Detection</span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
            Auto-Detected
          </span>
        </div>

        <div className="space-y-2">
          {smartAlerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-center justify-between p-3 rounded-lg bg-[#06080F] border border-[#151B2C] text-xs"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    alert.type === "CRITICAL"
                      ? "bg-rose-500 animate-pulse"
                      : alert.type === "WARNING"
                      ? "bg-amber-500"
                      : "bg-sky-400"
                  }`}
                />
                <span className="font-semibold text-white">{alert.text}</span>
              </div>
              <span className="text-nexus-muted text-[11px]">{alert.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Form & Stream Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Submission Form (5 cols) */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-[#0B0F19] border border-[#151B2C] rounded-xl p-5 space-y-4 shadow-sm"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-text-secondary">
            Submit EOD Report
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-nexus-muted mb-1">
                Team Member
              </label>
              <input
                type="text"
                required
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-nexus-muted mb-1">
                Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
              >
                <option value="Setter">Setter</option>
                <option value="Closer">Closer</option>
                <option value="Manager">Manager</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-nexus-muted mb-1">
                Outreach / DMs Sent
              </label>
              <input
                type="number"
                value={outreachSent}
                onChange={(e) => setOutreachSent(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-nexus-muted mb-1">
                Calls Booked / Closed
              </label>
              <input
                type="number"
                value={callsBooked}
                onChange={(e) => setCallsBooked(e.target.value)}
                className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-nexus-muted mb-1">
              Today&apos;s Key Wins & Highlight
            </label>
            <textarea
              rows={2}
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              placeholder="What went well today?"
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#10D078]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-nexus-muted mb-1">
              Blockers / Need Support With
            </label>
            <input
              type="text"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              placeholder="Any roadblocks?"
              className="w-full bg-[#06080F] border border-[#151B2C] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#10D078]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#10D078] hover:bg-[#0EB86A] text-black font-extrabold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-[#10D078]/20"
          >
            <IconSend size={16} />
            Submit Daily EOD
          </button>
        </form>

        {/* Submitted EOD Reports Stream (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-nexus-text-secondary">
            Submitted Reports Stream ({reports.length})
          </h3>

          <div className="space-y-3">
            {loading ? (
              <div className="bg-[#0B0F19] border border-[#151B2C] p-8 rounded-xl text-center text-nexus-muted text-xs">
                Loading live team reports...
              </div>
            ) : reports.length === 0 ? (
              <div className="bg-[#0B0F19] border border-[#151B2C] p-8 rounded-xl text-center text-nexus-muted text-xs">
                No daily EOD reports submitted yet today. Use the form to submit one.
              </div>
            ) : (
              reports.map((rep) => (
                <div
                  key={rep.id}
                  className="bg-[#0B0F19] border border-[#151B2C] rounded-xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex justify-between items-start pb-2 border-b border-[#151B2C]">
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        {rep.repName}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider bg-[#10D078]/10 text-[#10D078] border border-[#10D078]/20">
                          {rep.role}
                        </span>
                      </h4>
                    </div>
                    <span className="text-xs text-nexus-muted font-medium">
                      {new Date(rep.createdAt).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-[#06080F] p-2.5 rounded-lg border border-[#151B2C]">
                      <span className="text-nexus-muted block">Outreach Sent:</span>
                      <span className="font-bold text-[#38BDF8] text-sm">{rep.outreachSent}</span>
                    </div>
                    <div className="bg-[#06080F] p-2.5 rounded-lg border border-[#151B2C]">
                      <span className="text-nexus-muted block">Bookings / Deals:</span>
                      <span className="font-bold text-[#10D078] text-sm">{rep.callsBooked}</span>
                    </div>
                  </div>

                  <div className="text-xs space-y-1">
                    {rep.wins && (
                      <p className="text-white">
                        <strong>🚀 Wins:</strong> {rep.wins}
                      </p>
                    )}
                    {rep.blockers && (
                      <p className="text-nexus-text-secondary">
                        <strong>⚠️ Blockers:</strong> {rep.blockers}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
