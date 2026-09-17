"use client";

import { useEffect, useState } from "react";
import { IconX } from "@tabler/icons-react";
interface AssignmentRule {
  id: string;
  name: string;
  priority: number;
  strategy: string;
  targetUserId: string | null;
  targetTeamId: string | null;
  enabled: boolean;
}

export default function AssignmentRulesPage() {
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    priority: 1,
    strategy: "ROUND_ROBIN",
    targetTeamId: "",
    enabled: true
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const [rulesRes, teamsRes] = await Promise.all([
          fetch("/api/assignment/rules"),
          fetch("/api/team")
        ]);
        if (rulesRes.ok) {
          const data = await rulesRes.json();
          // The endpoint returns data directly or wrapped depending on route. Check both.
          setRules(Array.isArray(data) ? data : (data.rules || []));
        }
        if (teamsRes.ok) {
          const tData = await teamsRes.json();
          setTeams(tData.teams || []);
          if (tData.teams && tData.teams.length > 0) {
            setFormData(prev => ({ ...prev, targetTeamId: tData.teams[0].id }));
          }
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/assignment/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        const newRule = await res.json();
        setRules([...rules, newRule].sort((a, b) => a.priority - b.priority));
        setShowModal(false);
        setFormData({
          name: "",
          priority: 1,
          strategy: "ROUND_ROBIN",
          targetTeamId: teams.length > 0 ? teams[0].id : "",
          enabled: true
        });
      }
    } catch (err) {
      console.error("Failed to create rule:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-nexus-bg">
      <div className="px-6 py-4 border-b border-nexus-border">
        <h1 className="text-xl font-bold text-nexus-text">Assignment Rules</h1>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-nexus-text">Lead Assignment Rules</h1>
            <button 
              onClick={() => setShowModal(true)}
              className="px-4 py-2 bg-nexus-primary text-white rounded-md text-sm font-medium hover:bg-nexus-primary/90 transition-colors"
            >
              + Create Rule
            </button>
          </div>

          <div className="bg-nexus-surface rounded-xl border border-nexus-border overflow-hidden">
            <div className="p-4 border-b border-nexus-border bg-nexus-surface/50">
              <h2 className="font-semibold text-nexus-text">Active Rules Engine</h2>
              <p className="text-sm text-nexus-text-secondary mt-1">
                Rules are evaluated in order of priority (highest first) upon lead creation.
              </p>
            </div>
            {loading ? (
              <div className="p-8 text-center text-nexus-text-secondary">Loading rules...</div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-nexus-text-secondary">No assignment rules configured. Leads will fallback to admin.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-nexus-text">
                  <thead className="bg-nexus-surface/50 border-b border-nexus-border">
                    <tr>
                      <th className="px-6 py-3 font-medium">Priority</th>
                      <th className="px-6 py-3 font-medium">Rule Name</th>
                      <th className="px-6 py-3 font-medium">Strategy</th>
                      <th className="px-6 py-3 font-medium">Target ID</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nexus-border">
                    {rules.map((rule) => (
                      <tr key={rule.id} className="hover:bg-nexus-surface/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-nexus-primary">{rule.priority}</td>
                        <td className="px-6 py-4 font-medium">{rule.name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs font-medium bg-nexus-primary/10 text-nexus-primary rounded-md">
                            {rule.strategy}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-nexus-text-secondary font-mono text-xs">
                          {rule.targetUserId || rule.targetTeamId || "—"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={
                            "px-2 py-1 text-xs font-medium rounded-md " +
                            (rule.enabled ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')
                          }>
                            {rule.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-nexus-card border border-nexus-border rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-nexus-border">
              <h3 className="font-bold text-nexus-text">Create Assignment Rule</h3>
              <button onClick={() => setShowModal(false)} className="text-nexus-text-secondary hover:text-nexus-text">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">Rule Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-nexus-bg border border-nexus-border rounded-md px-3 py-2 text-nexus-text focus:border-nexus-primary"
                    placeholder="e.g. Sales Round Robin"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">Strategy</label>
                  <select
                    value={formData.strategy}
                    onChange={e => setFormData({ ...formData, strategy: e.target.value })}
                    className="w-full bg-nexus-bg border border-nexus-border rounded-md px-3 py-2 text-nexus-text focus:border-nexus-primary"
                  >
                    <option value="ROUND_ROBIN">Round Robin</option>
                    <option value="TEAM">Team Broadcast</option>
                    <option value="SPECIFIC_USER">Specific User</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-nexus-text mb-1">Target Team</label>
                  <select
                    value={formData.targetTeamId}
                    onChange={e => setFormData({ ...formData, targetTeamId: e.target.value })}
                    className="w-full bg-nexus-bg border border-nexus-border rounded-md px-3 py-2 text-nexus-text focus:border-nexus-primary"
                  >
                    {teams.length === 0 ? <option value="">No teams available</option> : null}
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-nexus-text mb-1">Priority</label>
                    <input
                      required
                      type="number"
                      min="1"
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })}
                      className="w-full bg-nexus-bg border border-nexus-border rounded-md px-3 py-2 text-nexus-text focus:border-nexus-primary"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 mb-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.enabled}
                        onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                        className="rounded border-nexus-border bg-nexus-bg text-nexus-primary focus:ring-nexus-primary"
                      />
                      <span className="text-sm font-medium text-nexus-text">Enabled</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-4 border-t border-nexus-border bg-nexus-surface/30 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-nexus-text hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-nexus-primary text-white rounded-md hover:bg-nexus-primary/90 transition-colors"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
