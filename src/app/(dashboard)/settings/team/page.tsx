"use client";

import { useEffect, useState } from "react";
import { IconUsers, IconX } from "@tabler/icons-react";
import { useAuthStore } from "@/store/auth";
import { useRouter } from "next/navigation";


interface Team {
  id: string;
  name: string;
  isActive: boolean;
  members: any[];
}

export default function TeamsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.role === "USER") {
      router.replace("/dashboard");
      return;
    }

    async function fetchData() {
      try {
        const [teamRes, userRes] = await Promise.all([
          fetch("/api/team"),
          fetch("/api/users?activeOnly=true")
        ]);
        if (teamRes.ok) {
          const data = await teamRes.json();
          setTeams(data.teams || []);
        }
        if (userRes.ok) {
          const uData = await userRes.json();
          // Handling grouped response if admin or flat if not
          if (uData.allUsers) setUsersList(uData.allUsers);
          else if (Array.isArray(uData)) setUsersList(uData);
        }
      } catch (e) {
        console.error("Error fetching data:", e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [user, router]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName }),
      });
      if (res.ok) {
        const data = await res.json();
        setTeams([data.team, ...teams]);
        setNewTeamName("");
      }
    } catch (e) {
      console.error("Failed to create team", e);
    }
  };

  const openManageMembers = (team: Team) => {
    setEditingTeam(team);
    const existingIds = new Set(team.members.map((m: any) => m.userId));
    setSelectedUserIds(existingIds);
  };

  const handleToggleUser = (userId: string) => {
    const next = new Set(selectedUserIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setSelectedUserIds(next);
  };

  const handleSaveMembers = async () => {
    if (!editingTeam) return;
    try {
      const res = await fetch(`/api/team/${editingTeam.id}/members`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: Array.from(selectedUserIds) })
      });
      if (res.ok) {
        const data = await res.json();
        setTeams(teams.map(t => t.id === data.team.id ? data.team : t));
        setEditingTeam(null);
      }
    } catch (e) {
      console.error("Failed to update members", e);
    }
  };

  if (user?.role === "USER") return null;

  return (
    <div className="flex flex-col h-full bg-nexus-bg">
      <div className="px-6 py-4 border-b border-nexus-border">
        <h1 className="text-xl font-bold text-nexus-text">Teams Management</h1>
      </div>
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="bg-nexus-surface rounded-xl border border-nexus-border p-6">
            <h2 className="font-semibold text-nexus-text mb-4">Create New Team</h2>
            <form onSubmit={handleCreateTeam} className="flex gap-4">
              <input
                type="text"
                placeholder="Team Name"
                className="flex-1 bg-nexus-bg border border-nexus-border rounded-md px-4 py-2 text-nexus-text focus:outline-none focus:border-nexus-primary"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
              <button
                type="submit"
                className="px-6 py-2 bg-nexus-primary text-white rounded-md font-medium hover:bg-nexus-primary/90 transition-colors"
                disabled={!newTeamName.trim()}
              >
                Create
              </button>
            </form>
          </div>

          <div className="bg-nexus-surface rounded-xl border border-nexus-border overflow-hidden">
            <div className="p-4 border-b border-nexus-border bg-nexus-surface/50">
              <h2 className="font-semibold text-nexus-text">Organization Teams</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-nexus-text-secondary">Loading teams...</div>
            ) : teams.length === 0 ? (
              <div className="p-8 text-center text-nexus-text-secondary">No teams created yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-nexus-text">
                  <thead className="bg-nexus-surface/50 border-b border-nexus-border">
                    <tr>
                      <th className="px-6 py-3 font-medium">Team Name</th>
                      <th className="px-6 py-3 font-medium">Members</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nexus-border">
                    {teams.map((team) => (
                      <tr key={team.id} className="hover:bg-nexus-surface/50 transition-colors">
                        <td className="px-6 py-4 font-medium">{team.name}</td>
                        <td className="px-6 py-4 text-nexus-text-secondary">
                          {team.members ? team.members.length : 0} members
                        </td>
                        <td className="px-6 py-4">
                          <span className={
                            "px-2 py-1 text-xs font-medium rounded-md " + 
                            (team.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400')
                          }>
                            {team.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openManageMembers(team)}
                            className="text-sm font-medium text-nexus-primary hover:text-nexus-primary/80 transition-colors flex items-center gap-1"
                          >
                            <IconUsers className="w-4 h-4" />
                            Manage Members
                          </button>
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

      {/* Manage Members Modal */}
      {editingTeam && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-nexus-card border border-nexus-border rounded-xl shadow-xl max-w-md w-full overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b border-nexus-border">
              <h3 className="font-bold text-nexus-text">Manage Members: {editingTeam.name}</h3>
              <button onClick={() => setEditingTeam(null)} className="text-nexus-text-secondary hover:text-nexus-text">
                <IconX className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto space-y-2">
              {usersList.length === 0 ? (
                <p className="text-sm text-nexus-text-secondary text-center py-4">No users found.</p>
              ) : (
                usersList.map((u) => {
                  // Admin user endpoints might return nested objects depending on role but array map works
                  const isChecked = selectedUserIds.has(u.id);
                  return (
                    <label key={u.id} className="flex items-center gap-3 p-3 rounded-lg border border-nexus-border hover:bg-nexus-surface/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleUser(u.id)}
                        className="w-4 h-4 rounded border-nexus-border bg-nexus-bg text-nexus-primary focus:ring-nexus-primary focus:ring-offset-nexus-bg"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-nexus-text">{u.name}</span>
                        <span className="text-xs text-nexus-text-secondary">{u.email}</span>
                      </div>
                    </label>
                  );
                })
              )}
            </div>
            <div className="p-4 border-t border-nexus-border bg-nexus-surface/30 flex justify-end gap-3">
              <button
                onClick={() => setEditingTeam(null)}
                className="px-4 py-2 text-sm font-medium text-nexus-text hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMembers}
                className="px-4 py-2 text-sm font-medium bg-nexus-primary text-white rounded-md hover:bg-nexus-primary/90 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
