"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SkeletonHeader } from "@/components/ui/Skeleton";

export default function MetaConfigurationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    appId: "",
    appSecret: "",
    instagramAppId: "",
    instagramAppSecret: "",
    webhookVerifyToken: "",
    facebookConfigId: "",
    instagramConfigId: "",
    enabled: false,
  });

  const [hasSecret, setHasSecret] = useState({
    appSecret: false,
    instagramAppSecret: false,
    webhookVerifyToken: false,
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/integrations/meta");
      if (!res.ok) {
        if (res.status === 403) throw new Error("Forbidden: SUPER_ADMIN access required.");
        throw new Error("Failed to fetch configuration");
      }
      const data = await res.json();

      setFormData(prev => ({
        ...prev,
        appId: data.appId || "",
        instagramAppId: data.instagramAppId || "",
        facebookConfigId: data.facebookConfigId || "",
        instagramConfigId: data.instagramConfigId || "",
        enabled: data.enabled || false,
      }));

      setHasSecret({
        appSecret: data.hasAppSecret,
        instagramAppSecret: data.hasInstagramAppSecret,
        webhookVerifyToken: data.hasWebhookVerifyToken,
      });

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/integrations/meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        throw new Error("Failed to save configuration");
      }

      setSuccess("Configuration saved successfully");

      // Clear out the secret inputs as they are not needed to be shown
      setFormData(prev => ({
        ...prev,
        appSecret: "",
        instagramAppSecret: "",
        webhookVerifyToken: "",
      }));

      // Refresh to update masked state
      await fetchConfig();
      router.refresh();

    } catch (err: any) {
      setError(err.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 lg:p-8 space-y-6 text-nexus-text">
        <SkeletonHeader />
        <div className="bg-nexus-card border border-nexus-border rounded-lg p-8 grid grid-cols-1 md:grid-cols-2 gap-8 animate-pulse">
          {Array.from({ length: 7 }).map((_, index) => (
            <div key={index} className="space-y-2">
              <div className="h-4 w-56 bg-nexus-border/40 rounded" />
              <div className="h-10 w-full bg-nexus-border/30 rounded-md" />
            </div>
          ))}
          <div className="md:col-span-2 h-10 w-32 bg-nexus-primary/20 rounded-md" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-6 lg:p-8">
      <h1 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-white">
        Meta Platform Configuration (SUPER ADMIN)
      </h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-md">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="w-full bg-white dark:bg-gray-800 p-8 rounded-lg shadow grid grid-cols-1 md:grid-cols-2 gap-8 border border-gray-200 dark:border-gray-700">

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Meta App ID
          </label>
          <input
            type="text"
            name="appId"
            value={formData.appId}
            onChange={handleChange}
            className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. 123456789012345"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Meta App Secret
          </label>
          <input
            type="password"
            name="appSecret"
            value={formData.appSecret}
            onChange={handleChange}
            className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={hasSecret.appSecret ? "••••••••••••••••" : "Enter new App Secret"}
          />
          {hasSecret.appSecret && (
            <p className="text-xs text-gray-500 mt-1">Leave empty to keep existing secret.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Facebook Login for Business Config ID
          </label>
          <input
            type="text"
            name="facebookConfigId"
            value={formData.facebookConfigId}
            onChange={handleChange}
            className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. 987654321098765"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Instagram Login for Business Config ID
          </label>
          <input
            type="text"
            name="instagramConfigId"
            value={formData.instagramConfigId}
            onChange={handleChange}
            className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. 123456789012345"
          />
        </div>



        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Instagram App ID
          </label>
          <input
            type="text"
            name="instagramAppId"
            value={formData.instagramAppId}
            onChange={handleChange}
            className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. 123456789012345"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Instagram App Secret
          </label>
          <input
            type="password"
            name="instagramAppSecret"
            value={formData.instagramAppSecret}
            onChange={handleChange}
            className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={hasSecret.instagramAppSecret ? "••••••••••••••••" : "Enter new Instagram App Secret"}
          />
          {hasSecret.instagramAppSecret && (
            <p className="text-xs text-gray-500 mt-1">Leave empty to keep existing secret.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Webhook Verify Token
          </label>
          <input
            type="password"
            name="webhookVerifyToken"
            value={formData.webhookVerifyToken}
            onChange={handleChange}
            className="w-full p-2 border rounded-md dark:bg-gray-900 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder={hasSecret.webhookVerifyToken ? "••••••••••••••••" : "Enter new Webhook Verify Token"}
          />
          {hasSecret.webhookVerifyToken && (
            <p className="text-xs text-gray-500 mt-1">Leave empty to keep existing secret.</p>
          )}
        </div>

        <div className="md:col-span-2 border-t border-gray-200 dark:border-gray-700 pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <label htmlFor="enabled-checkbox" className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              name="enabled"
              checked={formData.enabled}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer mr-2"
              id="enabled-checkbox"
            />
            Enabled
          </label>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 flex items-center"
          >
            {saving ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </>
            ) : (
              "Save Configuration"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
