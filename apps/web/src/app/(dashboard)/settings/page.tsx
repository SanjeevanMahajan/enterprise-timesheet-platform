"use client";

import { useEffect, useState } from "react";
import { getUserProfile } from "@/lib/auth";

type SettingsTab = "general" | "webhooks" | "api-keys" | "security";

// -- Mock data types ----------------------------------------------------------

interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

interface ApiKey {
  id: string;
  name: string;
  masked_key: string;
  created_at: string;
  last_used_at: string | null;
}

// -- Mock data ----------------------------------------------------------------

const MOCK_WEBHOOKS: Webhook[] = [
  {
    id: "wh-1",
    url: "https://hooks.example.com/timetrack",
    events: ["TimeLogApproved", "InvoiceGenerated"],
    active: true,
    created_at: "2025-11-15T10:30:00Z",
  },
  {
    id: "wh-2",
    url: "https://integrations.acme.io/webhook",
    events: ["TimesheetSubmitted", "TimeLogApproved"],
    active: false,
    created_at: "2025-12-01T14:20:00Z",
  },
];

const MOCK_API_KEYS: ApiKey[] = [
  {
    id: "ak-1",
    name: "CI/CD Pipeline",
    masked_key: "tt_live_****************************a3f2",
    created_at: "2025-10-20T09:00:00Z",
    last_used_at: "2026-03-08T16:45:00Z",
  },
  {
    id: "ak-2",
    name: "Reporting Integration",
    masked_key: "tt_live_****************************b7e1",
    created_at: "2025-12-05T11:30:00Z",
    last_used_at: "2026-03-07T08:12:00Z",
  },
];

const WEBHOOK_EVENT_TYPES = [
  "TimeLogApproved",
  "TimeLogRejected",
  "TimesheetSubmitted",
  "TimesheetApproved",
  "InvoiceGenerated",
  "InvoicePaid",
  "ProjectCreated",
  "ProjectArchived",
];

const CURRENCIES = [
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
  { value: "CAD", label: "CAD - Canadian Dollar" },
  { value: "AUD", label: "AUD - Australian Dollar" },
  { value: "JPY", label: "JPY - Japanese Yen" },
  { value: "CHF", label: "CHF - Swiss Franc" },
  { value: "INR", label: "INR - Indian Rupee" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("general");
  const [webhooks, setWebhooks] = useState<Webhook[]>(MOCK_WEBHOOKS);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>(MOCK_API_KEYS);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  // General settings form state
  const [orgName, setOrgName] = useState("Acme Corporation");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("America/New_York");

  // Webhook form state
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>([]);

  // API Key form state
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");

  const profile = getUserProfile();
  const isAdmin = profile?.role === "admin";

  if (!isAdmin) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-xl font-semibold mb-2">Access Restricted</h1>
        <p className="text-[14px] text-muted">
          Only administrators can access organization settings.
        </p>
      </div>
    );
  }

  function handleSaveGeneral() {
    // Mock save - in production this would call an API
    alert("Settings saved successfully.");
  }

  function handleAddWebhook() {
    if (!newWebhookUrl || newWebhookEvents.length === 0) return;
    const newHook: Webhook = {
      id: `wh-${Date.now()}`,
      url: newWebhookUrl,
      events: newWebhookEvents,
      active: true,
      created_at: new Date().toISOString(),
    };
    setWebhooks((prev) => [...prev, newHook]);
    setNewWebhookUrl("");
    setNewWebhookEvents([]);
    setShowWebhookForm(false);
  }

  function handleDeleteWebhook(id: string) {
    setWebhooks((prev) => prev.filter((w) => w.id !== id));
  }

  function handleToggleWebhookEvent(event: string) {
    setNewWebhookEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  }

  function handleGenerateKey() {
    if (!newKeyName) return;
    const fullKey = `tt_live_${Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;
    const masked = `tt_live_****************************${fullKey.slice(-4)}`;
    const newKey: ApiKey = {
      id: `ak-${Date.now()}`,
      name: newKeyName,
      masked_key: masked,
      created_at: new Date().toISOString(),
      last_used_at: null,
    };
    setApiKeys((prev) => [...prev, newKey]);
    setGeneratedKey(fullKey);
    setNewKeyName("");
    setShowKeyForm(false);
  }

  function handleRevokeKey(id: string) {
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    if (generatedKey) setGeneratedKey(null);
  }

  function handleDismissGeneratedKey() {
    setGeneratedKey(null);
  }

  return (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
          Settings
        </h1>
        <p className="mt-0.5 text-[13px] text-muted">
          Manage your organization configuration, integrations, and security.
        </p>
      </div>

      {/* Tab bar */}
      <div className="tab-bar mb-6">
        {(["general", "webhooks", "api-keys", "security"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-item ${tab === t ? "tab-item-active" : ""}`}
          >
            {t === "api-keys" ? "API Keys" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {tab === "general" && (
        <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
          <h2 className="text-[15px] font-semibold mb-1">Organization Settings</h2>
          <p className="text-[12px] text-muted mb-6">
            Configure your organization name, default currency, and timezone.
          </p>

          <div className="space-y-5 max-w-lg">
            {/* Organization Name */}
            <div>
              <label className="block text-[13px] font-medium mb-1.5">
                Organization Name
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="input"
                placeholder="Your organization name"
              />
            </div>

            {/* Default Currency */}
            <div>
              <label className="block text-[13px] font-medium mb-1.5">
                Default Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="input"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Timezone */}
            <div>
              <label className="block text-[13px] font-medium mb-1.5">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>

            {/* Save Button */}
            <div className="pt-2">
              <button
                onClick={handleSaveGeneral}
                className="btn btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {tab === "webhooks" && (
        <div className="space-y-6">
          {/* Add Webhook Button / Form */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">Registered Webhooks</h2>
              <p className="text-[12px] text-muted mt-0.5">
                Receive real-time notifications when events occur in your organization.
              </p>
            </div>
            <button
              onClick={() => setShowWebhookForm(!showWebhookForm)}
              className="btn btn-primary"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Webhook
            </button>
          </div>

          {/* Add Webhook Form */}
          {showWebhookForm && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h3 className="text-[14px] font-semibold mb-4">New Webhook</h3>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-[13px] font-medium mb-1.5">
                    Endpoint URL
                  </label>
                  <input
                    type="url"
                    value={newWebhookUrl}
                    onChange={(e) => setNewWebhookUrl(e.target.value)}
                    className="input"
                    placeholder="https://your-app.com/webhook"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-2">
                    Event Types
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {WEBHOOK_EVENT_TYPES.map((event) => (
                      <label
                        key={event}
                        className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] cursor-pointer transition-colors hover:bg-card-hover"
                      >
                        <input
                          type="checkbox"
                          checked={newWebhookEvents.includes(event)}
                          onChange={() => handleToggleWebhookEvent(event)}
                          className="h-3.5 w-3.5 rounded border-border text-primary accent-primary"
                        />
                        <span className="font-mono">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleAddWebhook}
                    disabled={!newWebhookUrl || newWebhookEvents.length === 0}
                    className="btn btn-primary"
                  >
                    Save Webhook
                  </button>
                  <button
                    onClick={() => {
                      setShowWebhookForm(false);
                      setNewWebhookUrl("");
                      setNewWebhookEvents([]);
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Webhooks List */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {webhooks.length === 0 ? (
              <div className="px-6 py-16 text-center text-[13px] text-muted">
                No webhooks registered yet. Click "Add Webhook" to get started.
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background/50 text-left text-muted">
                    <th className="px-4 py-2.5 font-medium">Endpoint</th>
                    <th className="px-4 py-2.5 font-medium">Events</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Created</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {webhooks.map((wh, i) => (
                    <tr
                      key={wh.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors animate-fade-in-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <td className="px-4 py-3 font-mono text-[12px] max-w-[240px] truncate">
                        {wh.url}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {wh.events.map((e) => (
                            <span
                              key={e}
                              className="inline-flex items-center rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary"
                            >
                              {e}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            wh.active
                              ? "bg-success/10 text-success"
                              : "bg-background text-muted"
                          }`}
                        >
                          {wh.active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {new Date(wh.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteWebhook(wh.id)}
                          className="btn btn-danger text-[12px]"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* API Keys Tab */}
      {tab === "api-keys" && (
        <div className="space-y-6">
          {/* Header + Generate Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[15px] font-semibold">API Keys</h2>
              <p className="text-[12px] text-muted mt-0.5">
                Manage API keys for programmatic access to your organization.
              </p>
            </div>
            <button
              onClick={() => setShowKeyForm(!showKeyForm)}
              className="btn btn-primary"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Generate API Key
            </button>
          </div>

          {/* Generate Key Form */}
          {showKeyForm && (
            <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
              <h3 className="text-[14px] font-semibold mb-4">New API Key</h3>
              <div className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-[13px] font-medium mb-1.5">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="input"
                    placeholder="e.g., CI/CD Pipeline, Reporting Integration"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleGenerateKey}
                    disabled={!newKeyName}
                    className="btn btn-primary"
                  >
                    Generate Key
                  </button>
                  <button
                    onClick={() => {
                      setShowKeyForm(false);
                      setNewKeyName("");
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Generated Key Alert */}
          {generatedKey && (
            <div className="rounded-xl border border-success/30 bg-success-light p-5 animate-fade-in-up">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[14px] font-semibold text-success mb-1">
                    API Key Generated
                  </h3>
                  <p className="text-[12px] text-muted mb-3">
                    Copy this key now. You will not be able to see it again.
                  </p>
                  <code className="block rounded-lg bg-background border border-border px-4 py-2.5 text-[12px] font-mono select-all break-all">
                    {generatedKey}
                  </code>
                </div>
                <button
                  onClick={handleDismissGeneratedKey}
                  className="ml-4 shrink-0 text-muted hover:text-foreground transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* API Keys List */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {apiKeys.length === 0 ? (
              <div className="px-6 py-16 text-center text-[13px] text-muted">
                No API keys generated yet. Click "Generate API Key" to create one.
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-background/50 text-left text-muted">
                    <th className="px-4 py-2.5 font-medium">Name</th>
                    <th className="px-4 py-2.5 font-medium">Key</th>
                    <th className="px-4 py-2.5 font-medium">Created</th>
                    <th className="px-4 py-2.5 font-medium">Last Used</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((key, i) => (
                    <tr
                      key={key.id}
                      className="border-b border-border-subtle last:border-0 hover:bg-card-hover transition-colors animate-fade-in-up"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <td className="px-4 py-3 font-medium">{key.name}</td>
                      <td className="px-4 py-3 font-mono text-[12px] text-muted">
                        {key.masked_key}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {new Date(key.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-muted whitespace-nowrap">
                        {key.last_used_at
                          ? new Date(key.last_used_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Never"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="btn btn-danger text-[12px]"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                          </svg>
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Security Tab */}
      {tab === "security" && (
        <div className="space-y-6">
          {/* SSO/OIDC Section */}
          <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-[15px] font-semibold">Single Sign-On (SSO)</h2>
                <p className="text-[12px] text-muted mt-0.5">
                  Configure OIDC-based single sign-on for your organization.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-background px-3 py-1 text-[11px] font-semibold text-muted border border-border">
                Disabled
              </span>
            </div>

            <div className="space-y-4 max-w-lg">
              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-muted">
                  OIDC Issuer URL
                </label>
                <div className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-muted">
                  Not configured
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5 text-muted">
                  Client ID
                </label>
                <div className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-[13px] text-muted">
                  Not configured
                </div>
              </div>
              <p className="text-[12px] text-muted">
                Contact your account manager to enable SSO for your organization.
              </p>
            </div>
          </div>

          {/* Password Policy Section */}
          <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up" style={{ animationDelay: "80ms" }}>
            <h2 className="text-[15px] font-semibold mb-1">Password Policy</h2>
            <p className="text-[12px] text-muted mb-5">
              Current password requirements for all users in your organization.
            </p>

            <div className="space-y-3">
              {[
                { label: "Minimum length", value: "12 characters" },
                { label: "Require uppercase", value: "Yes" },
                { label: "Require lowercase", value: "Yes" },
                { label: "Require number", value: "Yes" },
                { label: "Require special character", value: "Yes" },
                { label: "Password expiry", value: "90 days" },
                { label: "Max failed attempts", value: "5 (30-minute lockout)" },
              ].map((rule) => (
                <div
                  key={rule.label}
                  className="flex items-center justify-between rounded-lg bg-background px-4 py-2.5"
                >
                  <span className="text-[13px] font-medium">{rule.label}</span>
                  <span className="text-[13px] font-mono text-muted">{rule.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Session Management */}
          <div className="rounded-xl border border-border bg-card p-6 animate-fade-in-up" style={{ animationDelay: "160ms" }}>
            <h2 className="text-[15px] font-semibold mb-1">Session Management</h2>
            <p className="text-[12px] text-muted mb-5">
              Token lifetimes and session configuration.
            </p>

            <div className="space-y-3">
              {[
                { label: "Access token lifetime", value: "30 minutes" },
                { label: "Refresh token lifetime", value: "7 days" },
                { label: "Concurrent sessions", value: "Unlimited" },
                { label: "Token type", value: "JWT (RS256)" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg bg-background px-4 py-2.5"
                >
                  <span className="text-[13px] font-medium">{item.label}</span>
                  <span className="text-[13px] font-mono text-muted">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
