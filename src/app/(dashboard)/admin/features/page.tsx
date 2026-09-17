"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { IconPlus, IconEdit, IconTrash, IconCheck, IconX, IconDatabase, IconToggleLeft } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { SkeletonTable } from "@/components/ui/Skeleton";

export default function FeaturesAdminPage() {
  const [features, setFeatures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/features", {
        headers: { Authorization: `Bearer ${localStorage.getItem("nexus-token")}` },
      });
      if (!res.ok) throw new Error("Failed to load features");
      const data = await res.json();
      setFeatures(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/admin/features/${id}`, {
        method: "PATCH", // Update to use PATCH based on the latest route.ts
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("nexus-token")}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      fetchFeatures();
      toast.success(`Feature ${newStatus === "ACTIVE" ? "activated" : "deactivated"} successfully`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this feature? This might break existing plan limits if active.")) return;
    try {
      const res = await fetch(`/api/admin/features/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("nexus-token")}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete feature");
      }
      fetchFeatures();
      toast.success("Feature deleted successfully");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 text-nexus-text">
        <div className="flex items-center justify-between animate-pulse">
          <div>
            <div className="h-8 bg-nexus-border/50 rounded-lg w-32 mb-2"></div>
            <div className="h-4 bg-nexus-border/30 rounded-lg w-64"></div>
          </div>
          <div className="h-10 w-36 bg-nexus-primary/20 rounded-xl"></div>
        </div>
        <SkeletonTable rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-nexus-text">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-nexus-text">Features</h1>
          <p className="text-sm text-nexus-text-secondary mt-1">Manage global platform features and modules</p>
        </div>
        <Link
          href="/admin/features/new"
          className="flex items-center gap-2 px-4 py-2 bg-nexus-primary hover:bg-nexus-primary/90 text-nexus-bg font-semibold rounded-xl text-sm transition-colors shadow-lg"
        >
          <IconPlus size={18} />
          Create Feature
        </Link>
      </div>

      <div className="bg-nexus-card border border-nexus-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-nexus-hover/50 text-nexus-text-secondary text-xs uppercase tracking-wider border-b border-nexus-border">
                <th className="px-6 py-4 font-semibold">Name & Code</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Attributes</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-nexus-border">
              {features.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-nexus-muted text-sm">
                    No features found.
                  </td>
                </tr>
              ) : (
                features.map((feature) => (
                  <tr key={feature.id} className="hover:bg-nexus-hover/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-nexus-text">{feature.name}</div>
                      <div className="text-[11px] text-nexus-primary bg-nexus-primary/10 px-1.5 py-0.5 rounded inline-block mt-1 font-mono uppercase">
                        {feature.code}
                      </div>
                      <div className="text-xs text-nexus-muted mt-1 truncate max-w-xs">{feature.description}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold">{feature.featureType}</div>
                      {feature.module && <div className="text-[10px] text-nexus-muted uppercase mt-0.5">Mod: {feature.module}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {feature.isMetered && (
                          <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit">
                            <IconDatabase size={12} /> Metered
                          </span>
                        )}
                        {feature.isSystem && (
                          <span className="flex items-center gap-1 text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full w-fit">
                            System
                          </span>
                        )}
                        {!feature.isVisible && (
                          <span className="flex items-center gap-1 text-[10px] text-nexus-muted bg-white/5 px-2 py-0.5 rounded-full w-fit">
                            Hidden
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(feature.id, feature.status)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                          feature.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20"
                        }`}
                      >
                        {feature.status === "ACTIVE" ? <IconCheck size={14} /> : <IconX size={14} />}
                        {feature.status}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/features/${feature.id}`}
                          className="p-2 text-nexus-text-secondary hover:text-nexus-text hover:bg-nexus-hover rounded-lg transition-colors"
                          title="Edit Feature"
                        >
                          <IconEdit size={18} />
                        </Link>
                        {!feature.isSystem && (
                          <button
                            onClick={() => handleDelete(feature.id)}
                            className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Feature"
                          >
                            <IconTrash size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
