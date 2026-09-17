"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { IconArrowLeft, IconDeviceFloppy, IconLoader2, IconSettings, IconShieldLock } from "@tabler/icons-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/apiClient";

function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export default function FeatureDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [id, setId] = useState<string | null>(null);
  
  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  const isNew = id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [feature, setFeature] = useState<any>({
    code: "",
    name: "",
    description: "",
    featureType: "CAPABILITY",
    module: "",
    resource: "",
    action: "",
    status: "ACTIVE",
    isMetered: false,
    isSystem: false,
    isVisible: true,
  });

  useEffect(() => {
    if (!id) return;
    
    async function loadData() {
      if (isNew) {
        setLoading(false);
        return;
      }
      try {
        const data = await apiClient.get(`/api/admin/features/${id}`);
        setFeature(data);
      } catch (err: any) {
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, isNew]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    let isValid = true;
    if (!feature.name.trim()) { errors['name'] = 'Feature Name is required'; isValid = false; }
    if (!feature.code.trim()) { errors['code'] = 'Feature Code is required'; isValid = false; }
    
    setFieldErrors(errors);
    if (!isValid) {
      toast.error('Please fix the errors in the form.');
      setTimeout(() => {
        if (errors['name']) {
          document.getElementById('feature-name')?.focus();
        } else if (errors['code']) {
          document.getElementById('feature-code')?.focus();
        }
      }, 50);
    }
    return isValid;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const url = isNew ? "/api/admin/features" : `/api/admin/features/${id}`;
      const method = isNew ? "POST" : "PATCH"; // Using PATCH correctly

      const data = await (method === "POST" ? apiClient.post(url, feature) : apiClient.patch(url, feature));

      setSaving(false);
      toast.success("Feature saved successfully!");
      if (isNew && data?.id) {
        // We will wait for the user to close the success modal, so we'll just leave it.
        // Or we can smoothly redirect without forcing a modal close:
        setTimeout(() => router.push(`/admin/features/${data.id}`), 1000);
      }
    } catch (err: any) {
      toast.error(err.message);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-nexus-muted">
        <IconLoader2 className="animate-spin text-nexus-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="text-nexus-text">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <Link href="/admin/features" className="inline-flex items-center text-sm font-medium text-nexus-text-secondary hover:text-nexus-primary transition-colors mb-2">
            <IconArrowLeft size={16} className="mr-1" /> Back to Features
          </Link>
          <h1 className="text-3xl font-extrabold">{isNew ? "Create Feature" : "Edit Feature"}</h1>
          <p className="text-nexus-text-secondary mt-1">Configure global feature parameters and entitlements.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            type="button" 
            onClick={() => router.push('/admin/features')} 
            className="px-4 py-2 bg-nexus-card border border-nexus-border rounded-xl text-sm font-semibold hover:bg-nexus-hover transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-nexus-primary text-black rounded-xl text-sm font-bold shadow-lg hover:bg-nexus-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <IconLoader2 size={16} className="animate-spin" /> : <IconDeviceFloppy size={16} />}
            {saving ? 'Saving...' : 'Save Feature'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* MAIN CONTENT */}
        <div className="flex-1 space-y-8 min-w-0 w-full">
          
          {/* SECTION 1 - BASIC DETAILS */}
          <section className="bg-nexus-card border border-nexus-border rounded-2xl p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <IconSettings size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Feature Definition</h2>
                <p className="text-xs text-nexus-text-secondary">Core details identifying the feature in the engine.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-nexus-text-secondary">Feature Name *</label>
                <input
                  id="feature-name"
                  type="text"
                  required
                  value={feature.name}
                  onChange={(e) => { setFeature({ ...feature, name: e.target.value }); setFieldErrors(p => ({ ...p, name: '' })); }}
                  placeholder="e.g. Advanced Analytics"
                  className={classNames(
                    "w-full bg-nexus-bg border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-nexus-primary/50 transition-all",
                    fieldErrors['name'] ? "border-red-500/50 focus:border-red-500/50" : "border-nexus-border focus:border-nexus-primary"
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-nexus-text-secondary">Feature Code *</label>
                <input
                  id="feature-code"
                  type="text"
                  required
                  value={feature.code}
                  onChange={(e) => { setFeature({ ...feature, code: e.target.value.toUpperCase() }); setFieldErrors(p => ({ ...p, code: '' })); }}
                  className={classNames(
                    "w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none uppercase font-mono transition-all",
                    !isNew 
                      ? "bg-black/20 border-nexus-border/50 text-nexus-muted cursor-not-allowed" 
                      : fieldErrors['code'] ? "bg-nexus-bg border-red-500/50 focus:border-red-500/50 focus:ring-1 focus:ring-nexus-primary/50" : "bg-nexus-bg border-nexus-border focus:border-nexus-primary focus:ring-1 focus:ring-nexus-primary/50"
                  )}
                  disabled={!isNew}
                  placeholder="ADVANCED_ANALYTICS"
                />
                {!isNew && <p className="text-[10px] text-amber-400/80 mt-1 flex items-center gap-1"><IconShieldLock size={12}/> Code cannot be changed after creation.</p>}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-sm font-semibold text-nexus-text-secondary">Description</label>
                <textarea
                  rows={3}
                  value={feature.description || ""}
                  onChange={(e) => setFeature({ ...feature, description: e.target.value })}
                  placeholder="Briefly describe what this feature unlocks for the user..."
                  className="w-full bg-nexus-bg border border-nexus-border rounded-xl px-4 py-3 text-sm focus:border-nexus-primary focus:outline-none focus:ring-1 focus:ring-nexus-primary/50 transition-all resize-none"
                />
              </div>
            </div>
          </section>

          {/* SECTION 2 - PROPERTIES */}
          <section className="bg-nexus-card border border-nexus-border rounded-2xl p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold">Attributes & Types</h2>
              <p className="text-xs text-nexus-text-secondary">Define how the entitlement engine handles this feature.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-nexus-text-secondary">Feature Type</label>
                <select
                  value={feature.featureType}
                  onChange={(e) => setFeature({ ...feature, featureType: e.target.value })}
                  className="w-full bg-nexus-bg border border-nexus-border rounded-xl px-4 py-2.5 text-sm focus:border-nexus-primary focus:outline-none transition-all appearance-none"
                >
                  <option value="CAPABILITY">Capability (Boolean / Limit)</option>
                  <option value="MODULE">Module (Full Section Access)</option>
                  <option value="SECURITY">Security (Permissions / Config)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-nexus-text-secondary">Module Category</label>
                <input
                  type="text"
                  value={feature.module || ""}
                  onChange={(e) => setFeature({ ...feature, module: e.target.value })}
                  placeholder="e.g. CRM, FINANCES, ADMIN"
                  className="w-full bg-nexus-bg border border-nexus-border rounded-xl px-4 py-2.5 text-sm focus:border-nexus-primary focus:outline-none transition-all uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-nexus-text-secondary">Status</label>
                <select
                  value={feature.status}
                  onChange={(e) => setFeature({ ...feature, status: e.target.value })}
                  className={classNames(
                    "w-full bg-nexus-bg border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all appearance-none font-semibold",
                    feature.status === 'ACTIVE' ? "text-[#10D078] border-[#10D078]/30 focus:border-[#10D078]" : "text-nexus-text border-nexus-border"
                  )}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-nexus-border/50 grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className={classNames("flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer", feature.isMetered ? "bg-amber-500/10 border-amber-500/30" : "bg-nexus-bg border-nexus-border hover:bg-nexus-hover")}>
                <input
                  type="checkbox"
                  checked={feature.isMetered}
                  onChange={(e) => setFeature({ ...feature, isMetered: e.target.checked })}
                  className="mt-1 rounded bg-black/40 border-nexus-border/50 text-amber-500 focus:ring-amber-500/50"
                />
                <div>
                  <span className={classNames("text-sm font-bold block", feature.isMetered ? "text-amber-400" : "text-nexus-text")}>Metered Usage</span>
                  <span className="text-[10px] text-nexus-muted leading-tight mt-1 block">Tracks incremental usage events instead of static limits</span>
                </div>
              </label>

              <label className={classNames("flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer", feature.isVisible ? "bg-[#10D078]/10 border-[#10D078]/30" : "bg-nexus-bg border-nexus-border hover:bg-nexus-hover")}>
                <input
                  type="checkbox"
                  checked={feature.isVisible}
                  onChange={(e) => setFeature({ ...feature, isVisible: e.target.checked })}
                  className="mt-1 rounded bg-black/40 border-nexus-border/50 text-[#10D078] focus:ring-[#10D078]/50"
                />
                <div>
                  <span className={classNames("text-sm font-bold block", feature.isVisible ? "text-[#10D078]" : "text-nexus-text")}>Visible to Users</span>
                  <span className="text-[10px] text-nexus-muted leading-tight mt-1 block">Show this feature on public pricing tables</span>
                </div>
              </label>

              <label className={classNames("flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer", feature.isSystem ? "bg-purple-500/10 border-purple-500/30" : "bg-nexus-bg border-nexus-border hover:bg-nexus-hover")}>
                <input
                  type="checkbox"
                  checked={feature.isSystem}
                  onChange={(e) => setFeature({ ...feature, isSystem: e.target.checked })}
                  className="mt-1 rounded bg-black/40 border-nexus-border/50 text-purple-500 focus:ring-purple-500/50"
                />
                <div>
                  <span className={classNames("text-sm font-bold block", feature.isSystem ? "text-purple-400" : "text-nexus-text")}>System Lock</span>
                  <span className="text-[10px] text-nexus-muted leading-tight mt-1 block">Prevents normal admins from deleting this feature</span>
                </div>
              </label>
            </div>
          </section>
        </div>

        {/* SECTION 3 - SIDEBAR */}
        <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24">
          <div className="bg-nexus-card border border-nexus-border rounded-2xl p-5 shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-nexus-primary/5 rounded-bl-full pointer-events-none" />
            <h3 className="font-extrabold text-sm tracking-widest text-nexus-muted uppercase mb-4">Feature Summary</h3>
            
            <div className="space-y-4 relative z-10">
              <div>
                <div className="text-xl font-bold break-words">{feature.name || 'Unnamed'}</div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className={classNames("text-[10px] font-bold px-2 py-0.5 rounded-full border", feature.status === 'ACTIVE' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-nexus-muted/10 text-nexus-muted border-nexus-muted/20")}>
                    {feature.status}
                  </span>
                  {feature.isSystem && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">SYSTEM</span>}
                </div>
              </div>

              <div className="h-px bg-nexus-border/50" />

              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-nexus-muted">Type</span>
                  <span className="font-semibold text-nexus-primary">{feature.featureType}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-nexus-muted">Module</span>
                  <span className="font-semibold uppercase">{feature.module || 'Global'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
