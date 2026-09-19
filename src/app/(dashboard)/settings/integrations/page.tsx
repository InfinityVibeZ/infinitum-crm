"use client";

import { useState, useEffect } from "react";
import {
  IconPlugConnected,
  IconLoader2,
  IconUnlink,
  IconRefresh,
  IconCheck,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandWhatsapp,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react";
import toast from "react-hot-toast";
import { SkeletonHeader } from "@/components/ui/Skeleton";

const AVAILABLE_PROVIDERS = [
  {
    id: "FACEBOOK", providerId: "META", name: "Facebook", type: "SOCIAL",
    icon: IconBrandFacebook, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20",
    description: "Connect your Facebook Pages to track leads and analyze social engagement.",
    features: ["Lead generation tracking", "Page insights", "Ad campaign metrics"]
  },
  {
    id: "INSTAGRAM", providerId: "INSTAGRAM", name: "Instagram", type: "SOCIAL",
    icon: IconBrandInstagram, color: "text-pink-500", bg: "bg-pink-500/10", border: "border-pink-500/20",
    description: "Link Professional Instagram accounts to sync followers and direct messages.",
    features: ["Follower analytics", "Direct message sync", "Story insights"]
  },
  {
    id: "WHATSAPP", providerId: "WHATSAPP", name: "WhatsApp Business", type: "MESSAGING",
    icon: IconBrandWhatsapp, color: "text-[#25D366]", bg: "bg-[#25D366]/10", border: "border-[#25D366]/20",
    description: "Connect WhatsApp Business API to automate support and outreach messaging.",
    features: ["Automated templates", "Direct chat sync", "Read receipt tracking"]
  },
];

export default function SettingsIntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    try {
      const res = await fetch("/api/settings/integrations");
      if (!res.ok) throw new Error("Failed to load integrations");
      const data = await res.json();
      setIntegrations(data);
    } catch (err) {
      toast.error("Could not load integrations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    // Check URL params for OAuth results
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) {
      toast.success("Integration connected successfully");
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get("error")) {
      toast.error(params.get("error") || "OAuth failed");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [showAssetsFor, setShowAssetsFor] = useState<string | null>(null);
  const [discoveredAssets, setDiscoveredAssets] = useState<any[]>([]);

  const handleDiscoverAssets = async (integrationId: string) => {
    setActionLoading(`discover-${integrationId}`);
    try {
      const res = await fetch(`/api/settings/integrations/${integrationId}/assets`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to discover assets");

      setDiscoveredAssets(data.assets || []);
      setShowAssetsFor(integrationId);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveAssets = async (integrationId: string) => {
    setActionLoading(`save-assets-${integrationId}`);
    try {
      const res = await fetch(`/api/settings/integrations/${integrationId}/assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: discoveredAssets }) // Save all discovered for simplicity
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save assets");

      toast.success("Assets saved successfully!");
      setShowAssetsFor(null);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnect = async (id: string, providerId: string, name: string, type: string) => {
    console.log(`handleConnect called for: id=${id}, providerId=${providerId}`);
    setActionLoading(`connect-${id}`);
    try {
      if (providerId === "META" || providerId === "INSTAGRAM") {
        const intent = id === "INSTAGRAM" ? "instagram" : "facebook";
        const res = await fetch(`/api/settings/integrations/meta/auth?intent=${intent}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to initialize Meta connection");
        if (data.url) {
          console.log(`[${intent === 'instagram' ? 'Instagram' : 'Facebook'} OAuth] popup navigation started`);
          // Calculate popup position to center it
          const width = 600;
          const height = 700;
          const left = window.innerWidth / 2 - width / 2 + window.screenX;
          const top = window.innerHeight / 2 - height / 2 + window.screenY;

          const popup = window.open(
            data.url,
            "MetaOAuth",
            `width=${width},height=${height},top=${top},left=${left},status=no,menubar=no,toolbar=no`
          );

          if (!popup) {
            console.error("Popup blocked");
            toast.error("Popup blocked. Please allow popups for this site to connect Meta.");
            setActionLoading(null);
            return;
          }
          console.log("Popup opened successfully");

          const messageListener = async (event: MessageEvent) => {
            // SECURITY: validate origin
            if (event.origin !== window.location.origin) return;

            if (event.data?.type === "META_OAUTH_SUCCESS") {
              console.log("[Instagram OAuth] Parent received OAuth success");
              window.removeEventListener("message", messageListener);
              toast.success("Integration connected successfully!");
              await fetchIntegrations();
              setActionLoading(null);
            } else if (event.data?.type === "META_OAUTH_ERROR") {
              console.log("[Instagram OAuth] Parent received OAuth error", event.data?.error);
              window.removeEventListener("message", messageListener);
              toast.error(event.data?.error || "OAuth failed");
              setActionLoading(null);
            } else if (event.data?.type === "INSTAGRAM_PROFESSIONAL_ACCOUNT_REQUIRED") {
              console.log("[Instagram OAuth] Parent received Personal Account error");
              window.removeEventListener("message", messageListener);
              toast.error(
                <div className="flex flex-col gap-2">
                  <strong className="text-base">Instagram Professional Account Required</strong>
                  <p className="text-sm">This CRM can only connect Instagram Professional accounts (Business or Creator).</p>
                  <p className="text-sm">Your Instagram account is currently a Personal account.</p>
                  <p className="text-sm">Switch your existing Instagram account to a Professional account and try again.</p>
                </div>,
                { duration: 8000 }
              );
              setActionLoading(null);
            }
          };

          window.addEventListener("message", messageListener);
        }
        return;
      }

      // Mock flow for connecting other providers
      const res = await fetch("/api/settings/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerId,
          type: type,
          externalId: `ext_${providerId.toLowerCase()}_${Date.now()}`,
          displayName: `${name} Account`,
          credentialsPayload: { access_token: "mock_token", refresh_token: "mock_refresh" }
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");

      toast.success(`${name} connected successfully!`);
      await fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to disconnect ${name}?`)) return;

    setActionLoading(`disconnect-${id}`);
    try {
      const res = await fetch(`/api/settings/integrations/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to disconnect");
      }

      toast.success(`${name} disconnected.`);
      await fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTestConnection = async (id: string) => {
    setActionLoading(`test-${id}`);
    try {
      const res = await fetch(`/api/settings/integrations/${id}/test`, {
        method: "POST"
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to test connection");

      if (data.success) {
        toast.success("Connection test passed!");
      } else {
        toast.error(`Connection failed: ${data.errorMessage}`);
      }
      await fetchIntegrations();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const isIntegrationConnected = (integration: any) =>
    integration.status === "CONNECTED" &&
    integration.isActive === true;

  const connectedProviders = AVAILABLE_PROVIDERS.filter(p =>
    integrations.some(
      i => i.provider === p.providerId && isIntegrationConnected(i)
    )
  );

  const availableProviders = AVAILABLE_PROVIDERS.filter(p =>
    !integrations.some(
      i => i.provider === p.providerId && isIntegrationConnected(i)
    )
  );
  return (
    <div className="w-full max-w-7xl mx-auto space-y-12 text-nexus-text pb-16">

      {/* Immersive Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-nexus-border/50 pb-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <IconPlugConnected size={36} className="text-nexus-primary" />
            Integrations Hub
          </h1>
          <p className="text-base text-nexus-text-secondary max-w-2xl">
            Supercharge your CRM by connecting your favorite external platforms.
            Manage active syncs or discover new powerful tools below.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-12 text-nexus-text animate-pulse">
          <SkeletonHeader />
          <section className="space-y-6">
            <div className="h-8 w-56 bg-nexus-border/40 rounded-lg" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`active-skeleton-${index}`}
                  className="h-72 bg-nexus-card border border-nexus-border/50 rounded-2xl p-6 space-y-5"
                >
                  <div className="flex justify-between">
                    <div className="h-14 w-14 rounded-xl bg-nexus-border/40" />
                    <div className="h-6 w-20 rounded-full bg-nexus-border/30" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-6 w-32 bg-nexus-border/40 rounded" />
                    <div className="h-4 w-44 bg-nexus-border/30 rounded" />
                  </div>
                  <div className="h-20 bg-nexus-border/20 rounded-xl" />
                </div>
              ))}
            </div>
          </section>
          <section className="space-y-6">
            <div className="h-8 w-64 bg-nexus-border/40 rounded-lg" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`available-skeleton-${index}`}
                  className="h-56 bg-nexus-card border border-nexus-border/50 rounded-2xl p-6 space-y-4"
                >
                  <div className="h-14 w-14 rounded-2xl bg-nexus-border/40" />
                  <div className="h-6 w-40 bg-nexus-border/40 rounded" />
                  <div className="h-4 w-full bg-nexus-border/30 rounded" />
                  <div className="h-10 w-full bg-nexus-border/20 rounded-xl" />
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-16">

          {/* Active Connections Dashboard */}
          {connectedProviders.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-nexus-primary animate-pulse"></div>
                <h2 className="text-2xl font-bold text-white tracking-wide">Active Connections</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-stretch">
                {connectedProviders.map(provider => {
                  const activeIntegration = integrations.find(
                    i =>
                      i.provider === provider.providerId &&
                      i.status === "CONNECTED" &&
                      i.isActive === true
                  );
                  const IconComponent = provider.icon || IconPlugConnected;
                  const isError = activeIntegration.status === 'ERROR';

                  return (
                    <div
                      key={`connected-${provider.id}`}
                      className="group relative bg-[#0a0a0a] border border-white/10 hover:border-nexus-primary/30 rounded-2xl overflow-hidden transition-all duration-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)]"
                    >
                      {/* Gradient Header */}
                      <div className={`h-24 ${provider.bg} opacity-20 w-full absolute top-0 left-0 transition-opacity duration-500 group-hover:opacity-40`}></div>
                      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent to-[#0a0a0a] z-0"></div>

                      <div className="relative z-10 p-6 flex flex-col h-full">
                        {/* Top Section */}
                        <div className="flex justify-between items-start mb-4">
                          <div className={`p-3 rounded-xl bg-white/5 backdrop-blur-md border border-white/10 ${provider.color} shadow-lg group-hover:scale-110 transition-transform duration-500`}>
                            <IconComponent size={28} stroke={1.5} />
                          </div>

                          {/* Status Indicator */}
                          <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/5">
                            <span className="relative flex h-2.5 w-2.5">
                              {!isError && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-nexus-primary opacity-75"></span>}
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isError ? 'bg-red-500' : 'bg-nexus-primary'}`}></span>
                            </span>
                            <span className={`text-[10px] font-bold tracking-wider uppercase ${isError ? 'text-red-400' : 'text-nexus-primary'}`}>
                              {isError ? 'Error' : 'Active'}
                            </span>
                          </div>
                        </div>

                        {/* Title Section */}
                        <div className="mb-6">
                          <h3 className="font-bold text-xl text-white tracking-tight mb-1">{provider.name}</h3>
                          <p className="text-sm text-nexus-text-secondary truncate">
                            {activeIntegration.displayName !== `${provider.name} Account` ? activeIntegration.displayName : `Integration Linked`}
                          </p>
                        </div>

                        {/* Sync Info - Making it Useful */}
                        <div className="mt-auto bg-white/[0.02] rounded-xl p-4 border border-white/5 group-hover:bg-white/[0.04] transition-colors">
                          <div className="flex justify-between items-center mb-3">
                            <div className="flex items-center gap-2">
                              <IconRefresh size={14} className={actionLoading === `test-${activeIntegration.id}` ? "animate-spin text-nexus-primary" : "text-nexus-muted"} />
                              <span className="text-xs font-medium text-nexus-muted">Sync Status</span>
                            </div>
                            <span className="text-xs font-bold text-white">
                              {activeIntegration.lastSyncAt ? (
                                (() => {
                                  const diff = Date.now() - new Date(activeIntegration.lastSyncAt).getTime();
                                  const mins = Math.floor(diff / 60000);
                                  if (mins < 1) return "Just now";
                                  if (mins < 60) return `${mins}m ago`;
                                  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
                                  return `${Math.floor(mins / 1440)}d ago`;
                                })()
                              ) : 'Never'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => handleTestConnection(activeIntegration.id)}
                              disabled={actionLoading === `test-${activeIntegration.id}`}
                              className="flex-1 py-2 bg-nexus-primary/10 hover:bg-nexus-primary/20 text-nexus-primary text-xs font-bold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {actionLoading === `test-${activeIntegration.id}` ? 'Syncing...' : 'Force Sync'}
                            </button>
                            <button
                              onClick={() => handleDisconnect(activeIntegration.id, provider.name)}
                              disabled={actionLoading === `disconnect-${activeIntegration.id}`}
                              className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                              title="Disconnect Integration"
                            >
                              <IconUnlink size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Facebook Assets Management Slide-down */}
                        {provider.providerId === "META" && provider.id === "FACEBOOK" && (
                          <div className="mt-4">
                            <button
                              onClick={() => showAssetsFor === activeIntegration.id ? setShowAssetsFor(null) : handleDiscoverAssets(activeIntegration.id)}
                              disabled={actionLoading === `discover-${activeIntegration.id}`}
                              className="w-full flex justify-between items-center py-2 px-3 text-xs font-bold bg-white/5 text-white rounded-lg hover:bg-white/10 transition-all border border-white/5"
                            >
                              <span className="flex items-center gap-2">
                                {actionLoading === `discover-${activeIntegration.id}` && <IconLoader2 size={14} className="animate-spin" />}
                                Page Assets
                              </span>
                              {showAssetsFor === activeIntegration.id ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
                            </button>

                            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showAssetsFor === activeIntegration.id ? "max-h-96 opacity-100 mt-2" : "max-h-0 opacity-0"}`}>
                              <div className="p-3 bg-black/50 border border-white/10 rounded-lg">
                                {discoveredAssets.length === 0 ? (
                                  <p className="text-[10px] text-nexus-muted italic text-center py-2">No assets discovered.</p>
                                ) : (
                                  <ul className="space-y-1.5 mb-3 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                    {discoveredAssets.map((asset, i) => (
                                      <li key={i} className="text-[10px] p-2 bg-white/5 border border-white/5 rounded flex justify-between items-center">
                                        <span className="font-medium text-white truncate max-w-[120px]">{asset.name}</span>
                                        <span className="px-1.5 py-0.5 bg-white/10 rounded text-[9px] uppercase">{asset.type}</span>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                                <div className="flex justify-end">
                                  <button
                                    onClick={() => handleSaveAssets(activeIntegration.id)}
                                    disabled={actionLoading === `save-assets-${activeIntegration.id}`}
                                    className="w-full py-1.5 text-[10px] bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === `save-assets-${activeIntegration.id}` ? "Saving..." : "Save All"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Available Integrations List View */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold text-white tracking-wide border-b border-nexus-border/50 pb-4">
              Discover Integrations
            </h2>

            {availableProviders.length === 0 ? (
              <div className="text-center p-12 bg-nexus-card border border-nexus-border rounded-2xl">
                <IconCheck size={48} className="mx-auto text-nexus-primary mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-white mb-2">You're all connected!</h3>
                <p className="text-nexus-muted">You have successfully connected all available integrations.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-stretch">
                {availableProviders.map((provider) => {
                  const IconComponent = provider.icon || IconPlugConnected;

                  return (
                    <div
                      key={`available-${provider.id}`}
                      className="group flex h-full flex-col items-start justify-between p-6 bg-nexus-card border border-nexus-border hover:border-nexus-border/80 rounded-2xl transition-all duration-300 hover:bg-white/[0.02]"
                    >
                      <div className="flex items-start gap-6 flex-1 w-full">
                        <div className={`p-4 rounded-2xl ${provider.bg} ${provider.color} ring-1 ring-white/5 shadow-inner mt-1 md:mt-0`}>
                          <IconComponent size={36} stroke={1.5} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-bold text-xl text-white">{provider.name}</h3>
                            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-nexus-border text-nexus-text-secondary">
                              {provider.type}
                            </span>
                          </div>
                          <p className="text-sm text-nexus-text-secondary max-w-xl leading-relaxed">
                            {provider.description}
                          </p>
                          <div className="flex flex-wrap gap-2 pt-2">
                            {provider.features?.map((feat, idx) => (
                              <span key={idx} className="flex items-center gap-1.5 text-xs text-nexus-muted">
                                <IconCheck size={14} className="text-nexus-primary" /> {feat}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 shrink-0 w-full">
                        <button
                          onClick={() => handleConnect(provider.id, provider.providerId, provider.name, provider.type)}
                          disabled={actionLoading === `connect-${provider.id}`}
                          className="w-full md:w-40 flex items-center justify-center gap-2 py-3 px-6 text-sm font-bold bg-white text-black rounded-xl hover:bg-nexus-primary hover:text-black hover:shadow-[0_0_20px_rgba(16,208,120,0.4)] transition-all duration-300 disabled:opacity-50"
                        >
                          {actionLoading === `connect-${provider.id}` ? <IconLoader2 size={20} className="animate-spin" /> : "Connect"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
