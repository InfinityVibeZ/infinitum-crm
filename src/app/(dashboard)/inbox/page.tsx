"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  startInboxRealtime,
  stopInboxRealtime,
  type InboxRealtimeHandlers,
  type RealtimeConnectionState,
} from "@/lib/inbox/realtime-client";
import {
  applyMessageToList,
  applyConversationUpdated,
  applyConversationRead,
} from "@/lib/inbox/realtime-state";
import {
  IconSend,
  IconUser,
  IconBrandInstagram,
  IconBrandFacebook,
  IconMessage,
  IconSearch,
  IconArrowBack,
  IconInbox,
  IconAlertCircle,
  IconCheck,
} from "@tabler/icons-react";

interface InstagramProfile {
  username?: string | null;
  name?: string | null;
  externalId?: string | null;
}

interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  customFields?: {
    instagram?: InstagramProfile;
    [key: string]: any;
  } | null;
}

interface Message {
  id: string;
  content: string;
  direction: string;
  created_at: string;
  status?: string; // UI-only: "SENT" | "FAILED" | … (rendering distinction)
}

interface Conversation {
  id: string;
  channel: string;
  status: string;
  last_message_at: string | null;
  metadata: any;
  contact: Contact;
  integration: any;
  messages: Message[];
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] =
    useState<Conversation | null>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState("");

  // Prevent an older conversation request from overwriting
  // the messages of the currently selected conversation.
  const messagesRequestRef = useRef(0);

  // Phase 3.8.6 — Inbox Productivity state.
  const [searchInput, setSearchInput] = useState(""); // raw input
  const [search, setSearch] = useState(""); // debounced value sent to API
  const [filter, setFilter] = useState<"all" | "unread" | "channel">("all");
  const [channel, setChannel] = useState<string>("INSTAGRAM");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const listRequestRef = useRef(0);
  const conversationsRef = useRef<Conversation[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);

  /*
   * Phase 3.8.7.3 — SignalR realtime connection.
   *
   * Starts when the authenticated Inbox mounts, stops on unmount. Handlers
   * are dedup-safe: merging is by stable id, and unknown conversations are
   * never fabricated (REST remains the source of truth for anything not on
   * the current page). Realtime failures can never affect fetching or
   * sending — the client module swallows and logs them safely.
   */
  const [realtimeState, setRealtimeState] = useState<RealtimeConnectionState>("disconnected");
  const selectedConversationIdRef = useRef<string | null>(null);
  selectedConversationIdRef.current = selectedConversation?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    const handlers: InboxRealtimeHandlers = {
      onStateChange: (state) => {
        if (!cancelled) setRealtimeState(state);
      },

      // New inbound message from the webhook pipeline.
      onNewMessage: (event) => {
        const conversationId = typeof event.conversationId === "string" ? event.conversationId : "";
        if (!conversationId) return;

        const messageId = typeof event.messageId === "string" ? event.messageId : "";
        const preview = typeof event.preview === "string" ? event.preview : "";
        const createdAt = typeof event.createdAt === "string" ? event.createdAt : "";

        // Viewing this conversation → append immediately (dedup by id);
        // not viewing → list preview/unread updates via applyMessageToList.
        if (conversationId === selectedConversationIdRef.current && messageId) {
          setMessages((prev) =>
            prev.some((m) => m.id === messageId)
              ? prev
              : [
                  ...prev,
                  {
                    id: messageId,
                    content: preview,
                    direction: "INBOUND",
                    created_at: createdAt || new Date().toISOString(),
                    status: "SENT",
                  },
                ]
          );
          // FIX 2: the conversation is currently open — keep it READ.
          markAsRead(conversationId);
        }

        setConversations((prev) =>
          applyMessageToList(prev, {
            conversationId,
            messageId,
            direction: typeof event.direction === "string" ? event.direction : "INBOUND",
            preview,
            createdAt,
            lastMessageAt:
              typeof event.lastMessageAt === "string" ? event.lastMessageAt : undefined,
          })
        );
      },

      // Conversation metadata changed (status/ordering).
      onConversationUpdated: (event) => {
        setConversations((prev) =>
          applyConversationUpdated(prev, {
            conversationId:
              typeof event.conversationId === "string" ? event.conversationId : "",
            status: typeof event.status === "string" ? event.status : undefined,
            lastMessageAt:
              typeof event.lastMessageAt === "string" ? event.lastMessageAt : undefined,
            lastMessagePreview:
              typeof event.lastMessagePreview === "string" ? event.lastMessagePreview : undefined,
          })
        );
      },

      // Our own outbound message (echoed from another tab). Never duplicate —
      // the sending tab already appended it from the REST response.
      onOutboundMessage: (event) => {
        const conversationId = typeof event.conversationId === "string" ? event.conversationId : "";
        if (!conversationId) return;
        const messageId = typeof event.messageId === "string" ? event.messageId : "";

        if (conversationId === selectedConversationIdRef.current && messageId) {
          setMessages((prev) =>
            prev.some((m) => m.id === messageId)
              ? prev
              : [
                  ...prev,
                  {
                    id: messageId,
                    content: typeof event.preview === "string" ? event.preview : "",
                    direction: "OUTBOUND",
                    created_at:
                      typeof event.createdAt === "string"
                        ? event.createdAt
                        : new Date().toISOString(),
                    status: typeof event.status === "string" ? event.status : "SENT",
                  },
                ]
          );
        }

        setConversations((prev) =>
          applyMessageToList(prev, {
            conversationId,
            messageId,
            direction: "OUTBOUND",
            preview: typeof event.preview === "string" ? event.preview : "",
            createdAt: typeof event.createdAt === "string" ? event.createdAt : undefined,
            lastMessageAt:
              typeof event.lastMessageAt === "string" ? event.lastMessageAt : undefined,
          })
        );
      },

      // Read receipts from other tabs/sessions — local state only, no REST.
      onConversationRead: (event) => {
        setConversations((prev) =>
          applyConversationRead(prev, {
            conversationId:
              typeof event.conversationId === "string" ? event.conversationId : "",
            readAt: typeof event.readAt === "string" ? event.readAt : undefined,
          })
        );
      },
    };

    startInboxRealtime(handlers);

    return () => {
      cancelled = true;
      stopInboxRealtime();
    };
    // Start once per mount; handlers close over stable setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 3.8.6 — search debounce: raw input -> debounced query after 300ms.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Initial load.
  useEffect(() => {
    fetchConversations(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 3.8.6 — refetch (reset) whenever filters or the debounced
  // search change.
  useEffect(() => {
    fetchConversations(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filter, channel]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    // IMPORTANT:
    // Immediately clear the previous conversation's messages.
    setMessages([]);
    setSendError(null);

    fetchMessages(selectedConversation.id);

    if (
      selectedConversation.status === "UNREAD" ||
      isUnread(selectedConversation)
    ) {
      markAsRead(selectedConversation.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation]);

  /*
   * Phase 3.8.6 — Conversation list fetching.
   *
   * - reset=true  → replace the list (initial load / filter / search change).
   * - reset=false → append the next page (infinite scroll) using nextCursor.
   *
   * The stale-request guard mirrors the messages pane pattern:
   * only the latest request may update state.
   */
  const fetchConversations = async (reset: boolean = true) => {
    const requestId = ++listRequestRef.current;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams();
      if (!reset && nextCursor) {
        params.set("cursor", nextCursor);
      }
      if (search) {
        params.set("search", search);
      }
      if (filter === "channel") {
        params.set("filter", "channel");
        params.set("channel", channel);
      }

      const qs = params.toString();
      const res = await fetch(`/api/inbox/conversations${qs ? `?${qs}` : ""}`);

      if (!res.ok) {
        throw new Error(`Failed to fetch conversations: ${res.status}`);
      }

      const data = await res.json();

      // Ignore stale responses (user changed filters while this was in flight).
      if (requestId !== listRequestRef.current) {
        return;
      }

      const page: Conversation[] = data.conversations || [];

      if (reset) {
        setConversations(page);
      } else {
        // Append, de-duplicating by id in case of cursor overlap races.
        setConversations((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...page.filter((c) => !seen.has(c.id))];
        });
      }

      setNextCursor(data.nextCursor ?? null);
      conversationsRef.current =
        reset
          ? page
          : [
              ...conversationsRef.current.filter(
                (c) => !page.some((p) => p.id === c.id)
              ),
              ...page,
            ];
    } catch (error) {
      if (requestId === listRequestRef.current) {
        console.error("Failed to fetch conversations", error);
      }
    } finally {
      if (requestId === listRequestRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  const fetchMessages = async (conversationId: string) => {
    // Generate a unique request ID.
    // Only the latest request is allowed to update state.
    const requestId = ++messagesRequestRef.current;

    setMessagesLoading(true);

    try {
      console.log("[Inbox] Loading conversation messages:", {
        conversationId,
        requestId,
      });

      const res = await fetch(
        `/api/inbox/conversations/${conversationId}/messages`,
        {
          cache: "no-store",
        }
      );

      if (!res.ok) {
        throw new Error(`Failed to fetch messages: ${res.status}`);
      }

      const data = await res.json();

      // User may have switched conversations while this request
      // was still running.
      if (requestId !== messagesRequestRef.current) {
        console.log("[Inbox] Ignoring stale message response:", {
          conversationId,
          requestId,
          currentRequestId: messagesRequestRef.current,
        });

        return;
      }

      const loadedMessages: Message[] = data.messages || [];

      console.log("[Inbox] Messages loaded:", {
        conversationId,
        requestId,
        count: loadedMessages.length,
        messageIds: loadedMessages.map((m) => m.id),
      });

      // Replace the entire message collection.
      // NEVER append here.
      setMessages(loadedMessages);
    } catch (error) {
      // Ignore errors from stale requests.
      if (requestId !== messagesRequestRef.current) {
        return;
      }

      console.error("Failed to fetch messages", error);
      setMessages([]);
    } finally {
      if (requestId === messagesRequestRef.current) {
        setMessagesLoading(false);
      }
    }
  };

  const markAsRead = async (conversationId: string) => {
    try {
      await fetch(`/api/inbox/conversations/${conversationId}/read`, {
        method: "POST",
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                metadata: {
                  ...c.metadata,
                  lastReadAt: new Date().toISOString(),
                },
              }
            : c
        )
      );
    } catch (error) {
      console.error("Failed to mark as read", error);
    }
  };

  // Phase 3.8.5 — Outbound Instagram messaging.
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Only Instagram conversations with an active integration can send.
  const canSend = (conv: Conversation) =>
    conv.channel.toUpperCase() === "INSTAGRAM" &&
    !!conv.integration?.id &&
    conv.integration?.isActive !== false;

  const sendMessage = async () => {
    if (!selectedConversation || !canSend(selectedConversation)) return;

    const text = replyText.trim();
    if (!text) return;

    // Client-side duplicate-send guard (server is authoritative).
    if (sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    setSendError(null);

    try {
      const res = await fetch(
        `/api/inbox/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 409 = server-side duplicate rejection.
        if (res.status === 409) {
          setReplyText("");
          setSendError("This exact message was just sent.");
        } else {
          setSendError(
            data?.error ||
              `Failed to send message (${res.status})`
          );
        }
        return;
      }

      // Append the persisted message (server-returned, includes id/status).
      const sentMessage: Message = data.message;

      if (sentMessage) {
        setMessages((prev) => [...prev, sentMessage]);
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConversation.id
            ? {
                ...c,
                last_message_at: new Date().toISOString(),
              }
            : c
        )
      );

      setReplyText("");
    } catch (error) {
      console.error("Failed to send message", error);
      setSendError("Failed to send message. Please try again.");
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  // Phase 3.8.6 — auto-scroll the messages pane to the latest message.
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, selectedConversation?.id]);

  const isUnread = (conv: Conversation) => {
    if (!conv.last_message_at) return false;

    const lastMsgDate = new Date(conv.last_message_at);
    const lastReadAt = conv.metadata?.lastReadAt;

    if (!lastReadAt) return true;

    return new Date(lastReadAt) < lastMsgDate;
  };

  /*
   * Phase 3.8.6 — Unread tab.
   *
   * SAFETY: the canonical unread definition remains metadata.lastReadAt vs
   * last_message_at (client-side). Conversation.status is NOT used — the
   * pipeline never sets it to UNREAD, so a server-side unread filter would
   * be a different (incorrect) definition. Documented limitation: the
   * Unread tab filters pages the client has already loaded; more unread
   * conversations may exist beyond the loaded pages — use infinite scroll
   * to load more.
   */
  const visibleConversations =
    filter === "unread"
      ? conversations.filter(isUnread)
      : conversations;

  const unreadCount = conversations.filter(isUnread).length;

  // Phase 3.8.6 — relative time for list metadata ("2m", "3h", "5d").
  const relativeTime = (iso: string | null) => {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString();
  };

  // UI-only: full date separator label between messages.
  const dateSeparatorLabel = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return "Today";
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
    });
  };

  const renderChannelIcon = (channel: string, size = 14) => {
    switch (channel.toUpperCase()) {
      case "INSTAGRAM":
        return <IconBrandInstagram size={size} className="text-pink-400" />;
      case "FACEBOOK":
        return <IconBrandFacebook size={size} className="text-blue-400" />;
      default:
        return <IconMessage size={size} className="text-nexus-muted" />;
    }
  };

  const getInstagramUsername = (conversation: Conversation) => {
    if (conversation.channel.toUpperCase() !== "INSTAGRAM") {
      return null;
    }

    return (
      conversation.contact?.customFields?.instagram?.username ||
      null
    );
  };

  // UI-only: deterministic initials avatar.
  const Avatar = ({
    name,
    size = "md",
  }: {
    name: string;
    size?: "sm" | "md";
  }) => {
    const initials = (name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("");

    const dims =
      size === "sm" ? "w-8 h-8 text-[11px]" : "w-10 h-10 text-sm";

    return (
      <div
        aria-hidden="true"
        className={`${dims} shrink-0 rounded-full bg-nexus-hover border border-nexus-border flex items-center justify-center font-semibold text-nexus-text-secondary select-none`}
      >
        {initials}
      </div>
    );
  };

  // UI-only: subtle custom scrollbar classes.
  const scrollAreaClass = "inbox-scroll";

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden overflow-x-hidden bg-nexus-bg">
      <style jsx global>{`
        .inbox-scroll {
          scrollbar-width: thin;
          scrollbar-color: #232b40 transparent;
        }
        .inbox-scroll::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .inbox-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .inbox-scroll::-webkit-scrollbar-thumb {
          background-color: #232b40;
          border-radius: 9999px;
        }
        .inbox-scroll::-webkit-scrollbar-thumb:hover {
          background-color: #2e3852;
        }
      `}</style>

      {/* ─────────────────── Sidebar: Conversation List ─────────────────── */}
      <aside
        aria-label="Conversation list"
        className={`w-full md:w-[360px] lg:w-[400px] shrink-0 border-r border-nexus-border bg-nexus-card flex flex-col min-h-0 overflow-hidden ${
          selectedConversation ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Panel header */}
        <div className="px-4 pt-4 pb-3 border-b border-nexus-border shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <IconInbox size={18} className="text-nexus-text-secondary" />
              <h1 className="text-base font-semibold text-nexus-text tracking-tight">
                Inbox
              </h1>
              {/* Realtime connection status — subtle, non-intrusive. */}
              <span
                role="status"
                aria-label={`Realtime connection ${realtimeState}`}
                title={
                  realtimeState === "connected"
                    ? "Live updates connected"
                    : realtimeState === "reconnecting"
                      ? "Reconnecting to live updates…"
                      : realtimeState === "connecting"
                        ? "Connecting to live updates…"
                        : "Live updates offline — using manual refresh"
                }
                className={`ml-1 w-2 h-2 rounded-full shrink-0 ${
                  realtimeState === "connected"
                    ? "bg-emerald-500"
                    : realtimeState === "reconnecting" || realtimeState === "connecting"
                      ? "bg-amber-400 animate-pulse"
                      : "bg-nexus-muted/50"
                }`}
              />
            </div>
            <span className="text-xs text-nexus-muted tabular-nums">
              {conversations.length}{" "}
              {conversations.length === 1 ? "conversation" : "conversations"}
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 text-blue-400">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-blue-400"
                    aria-hidden="true"
                  />
                  {unreadCount} unread
                </span>
              )}
            </span>
          </div>

          {/* Search (debounced 300ms) */}
          <div className="relative">
            <IconSearch
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-nexus-muted pointer-events-none"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search conversations…"
              aria-label="Search conversations"
              className="w-full bg-nexus-bg border border-nexus-border rounded-lg pl-9 pr-3 py-2 text-sm text-nexus-text placeholder:text-nexus-muted/70 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30"
            />
          </div>

          {/* Filter chips */}
          <div
            role="tablist"
            aria-label="Filter conversations"
            className="flex gap-1.5 mt-3"
          >
            {(
              [
                { key: "all", label: "All" },
                { key: "unread", label: "Unread" },
                { key: "channel", label: "Instagram" },
              ] as const
            ).map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
                    active
                      ? "bg-blue-600/90 border-blue-500/60 text-white"
                      : "bg-transparent border-nexus-border text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover"
                  }`}
                >
                  {tab.key === "channel" && (
                    <IconBrandInstagram
                      size={12}
                      className="inline-block mr-1 -mt-0.5"
                    />
                  )}
                  {tab.label}
                  {tab.key === "unread" && unreadCount > 0 && (
                    <span
                      className={`ml-1.5 tabular-nums ${
                        active ? "text-blue-100" : "text-blue-400"
                      }`}
                    >
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Conversation list — independent scroll area */}
        <div className={`flex-1 min-h-0 overflow-y-auto ${scrollAreaClass}`}>
          {loading ? (
            /* Loading skeleton */
            <div className="divide-y divide-nexus-border/60" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-nexus-hover shrink-0" />
                  <div className="flex-1 space-y-2 py-0.5">
                    <div className="flex justify-between gap-2">
                      <div className="h-3 w-28 rounded bg-nexus-hover" />
                      <div className="h-2.5 w-8 rounded bg-nexus-hover" />
                    </div>
                    <div className="h-3 w-full rounded bg-nexus-hover/70" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleConversations.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-nexus-hover flex items-center justify-center mb-3">
                <IconInbox size={22} className="text-nexus-muted" />
              </div>
              <p className="text-sm font-medium text-nexus-text-secondary">
                {search
                  ? "No matching conversations"
                  : filter === "unread" && conversations.length > 0
                    ? "You're all caught up"
                    : "No conversations yet"}
              </p>
              <p className="mt-1 text-xs text-nexus-muted">
                {search
                  ? "Try a different search term."
                  : filter === "unread" && conversations.length > 0
                    ? "No unread messages right now."
                    : "New customer messages will appear here."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-nexus-border/60" role="list">
              {visibleConversations.map((conv) => {
                const unread = isUnread(conv);
                const isSelected = selectedConversation?.id === conv.id;
                const instagramUsername = getInstagramUsername(conv);
                const lastMsg = conv.messages?.[0];
                const isOutboundPreview =
                  lastMsg?.direction === "OUTBOUND";
                const displayName =
                  conv.contact.name || "Unknown Contact";

                return (
                  <li key={conv.id} role="listitem">
                    <button
                      onClick={() => {
                        if (selectedConversation?.id !== conv.id) {
                          setSelectedConversation(conv);
                        }
                      }}
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={`Conversation with ${displayName}${
                        unread ? ", unread" : ""
                      }`}
                      className={`w-full text-left flex gap-3 px-4 py-3.5 transition-colors focus:outline-none focus-visible:bg-nexus-hover ${
                        isSelected
                          ? "bg-blue-600/10 border-l-2 border-blue-500 -ml-0 pl-[calc(1rem-2px)]"
                          : "border-l-2 border-transparent hover:bg-nexus-hover/60"
                      }`}
                    >
                      <Avatar name={displayName} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span
                            className={`truncate text-sm ${
                              unread
                                ? "font-semibold text-nexus-text"
                                : "font-medium text-nexus-text/90"
                            }`}
                          >
                            {displayName}
                          </span>
                          <span className="text-[11px] text-nexus-muted shrink-0 tabular-nums">
                            {relativeTime(conv.last_message_at)}
                          </span>
                        </div>

                        {instagramUsername && (
                          <div className="text-[11px] text-nexus-muted truncate -mt-0.5">
                            @{instagramUsername}
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="text-nexus-muted shrink-0"
                            title={conv.channel}
                          >
                            {renderChannelIcon(conv.channel)}
                          </span>
                          <p
                            className={`text-[13px] truncate ${
                              unread
                                ? "text-nexus-text-secondary font-medium"
                                : "text-nexus-muted"
                            }`}
                          >
                            {lastMsg?.content
                              ? `${
                                  isOutboundPreview ? "You: " : ""
                                }${lastMsg.content}`
                              : "No messages yet"}
                          </p>
                        </div>
                      </div>

                      {/* Unread dot + text label (not color-only) */}
                      {unread && (
                        <span
                          className="shrink-0 self-center flex flex-col items-center gap-1"
                          aria-label="Unread"
                        >
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Infinite scroll sentinel + footer */}
          {!loading && visibleConversations.length > 0 && (
            <div
              ref={(node) => {
                if (!node) return;
                const observer = new IntersectionObserver(
                  (entries) => {
                    if (
                      entries[0].isIntersecting &&
                      nextCursor &&
                      !loadingMore &&
                      filter !== "unread"
                    )
                      fetchConversations(false);
                  },
                  { rootMargin: "100px" }
                );
                observer.observe(node);
                return () => observer.disconnect();
              }}
              className="py-3 text-center text-[11px] text-nexus-muted/70"
            >
              {loadingMore ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-nexus-border border-t-blue-500 rounded-full animate-spin" />
                  Loading…
                </span>
              ) : nextCursor && filter !== "unread" ? (
                ""
              ) : (
                "End of conversations"
              )}
            </div>
          )}
          {filter === "unread" && nextCursor && !loading && (
            <div className="py-3 text-center text-[11px] text-nexus-muted/70">
              Showing loaded conversations —{" "}
              <button
                className="underline underline-offset-2 hover:text-nexus-text focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 rounded"
                onClick={() => fetchConversations(false)}
              >
                load more
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ─────────────────── Main Area: Conversation View ─────────────────── */}
      <section
        aria-label="Active conversation"
        className={`flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col bg-nexus-bg ${
          selectedConversation ? "flex" : "hidden md:flex"
        }`}
      >
        {selectedConversation ? (
          <>
            {/* Conversation header — fixed */}
            <header className="shrink-0 px-4 py-3 border-b border-nexus-border bg-nexus-card flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile back */}
                <button
                  className="md:hidden -ml-1 p-1.5 rounded-lg text-nexus-muted hover:text-nexus-text hover:bg-nexus-hover transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                  onClick={() => setSelectedConversation(null)}
                  aria-label="Back to conversations"
                >
                  <IconArrowBack size={18} />
                </button>

                <Avatar
                  name={selectedConversation.contact.name || "Unknown Contact"}
                />

                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-nexus-text truncate leading-tight">
                    {selectedConversation.contact.name || "Unknown Contact"}
                  </h2>
                  <div className="flex items-center gap-1.5 text-xs text-nexus-muted mt-0.5">
                    {renderChannelIcon(selectedConversation.channel, 12)}
                    {getInstagramUsername(selectedConversation) ? (
                      <span className="truncate">
                        @{getInstagramUsername(selectedConversation)}
                      </span>
                    ) : (
                      <span className="capitalize truncate">
                        {selectedConversation.channel.toLowerCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </header>

            {/* Message thread — the ONLY vertical scroll area in the panel */}
            <div
              ref={threadRef}
              className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-1 ${scrollAreaClass}`}
            >
              {messagesLoading ? (
                <div className="space-y-3" aria-hidden="true">
                  {[70, 45, 60].map((w, i) => (
                    <div
                      key={i}
                      className={`flex ${
                        i % 2 ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className="h-9 rounded-2xl bg-nexus-hover/70 animate-pulse"
                        style={{ width: `${w}%`, maxWidth: "70%" }}
                      />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-nexus-hover flex items-center justify-center">
                    <IconMessage size={18} className="text-nexus-muted" />
                  </div>
                  <p className="text-sm text-nexus-text-secondary">No messages yet</p>
                  <p className="text-xs text-nexus-muted">
                    Messages in this conversation will appear here.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOutbound = msg.direction === "OUTBOUND";
                  const isFailed = msg.status === "FAILED";

                  // Date separator when the day changes.
                  const prev = idx > 0 ? messages[idx - 1] : null;
                  const showDateSep =
                    !prev ||
                    new Date(prev.created_at).toDateString() !==
                      new Date(msg.created_at).toDateString();

                  return (
                    <div key={msg.id}>
                      {showDateSep && (
                        <div
                          className="flex items-center gap-3 py-3"
                          role="separator"
                          aria-label={dateSeparatorLabel(msg.created_at)}
                        >
                          <div className="flex-1 h-px bg-nexus-border" />
                          <span className="text-[11px] font-medium text-nexus-muted px-1">
                            {dateSeparatorLabel(msg.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-nexus-border" />
                        </div>
                      )}

                      <div
                        className={`flex px-0.5 py-0.5 ${
                          isOutbound ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[75%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 ${
                            isFailed
                              ? "bg-red-500/10 border border-red-500/40"
                              : isOutbound
                                ? "bg-blue-600 text-white rounded-br-sm"
                                : "bg-nexus-card border border-nexus-border text-nexus-text rounded-bl-sm"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {msg.content}
                          </p>

                          <div
                            className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                              isFailed
                                ? "text-red-400"
                                : isOutbound
                                  ? "text-white/60"
                                  : "text-nexus-muted"
                            }`}
                          >
                            {/* Failed state: icon + label, not color-only */}
                            {isFailed && (
                              <>
                                <IconAlertCircle size={11} aria-hidden="true" />
                                <span>Failed to send</span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <time dateTime={msg.created_at}>
                              {new Date(msg.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </time>
                            {isOutbound && !isFailed && (
                              <IconCheck
                                size={11}
                                aria-hidden="true"
                                className="opacity-70"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Composer — fixed at the bottom, never scrolls away */}
            <div className="shrink-0 border-t border-nexus-border bg-nexus-card px-4 py-3">
              {sendError && (
                <div
                  role="alert"
                  className="mb-2 flex items-center gap-1.5 text-xs text-red-400"
                >
                  <IconAlertCircle size={13} aria-hidden="true" />
                  {sendError}
                </div>
              )}
              {canSend(selectedConversation) ? (
                <div className="flex items-end gap-2">
                  <textarea
                    rows={1}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message…"
                    aria-label="Message text"
                    maxLength={1000}
                    className="flex-1 resize-none bg-nexus-bg border border-nexus-border rounded-xl px-3.5 py-2.5 text-sm text-nexus-text placeholder:text-nexus-muted/70 outline-none transition-colors focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50 max-h-32"
                    disabled={sending}
                  />

                  <button
                    className="shrink-0 p-2.5 bg-blue-600 text-white rounded-xl transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    onClick={sendMessage}
                    disabled={sending || !replyText.trim()}
                    aria-label={sending ? "Sending message" : "Send message"}
                  >
                    {sending ? (
                      <span className="block w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <IconSend size={18} />
                    )}
                  </button>
                </div>
              ) : (
                <div
                  className="flex items-center gap-2 opacity-50 cursor-not-allowed"
                  title="Outbound messaging only supported for Instagram conversations"
                >
                  <input
                    type="text"
                    placeholder="Outbound messaging only supported for Instagram conversations"
                    aria-label="Messaging unavailable for this channel"
                    className="flex-1 bg-nexus-bg border border-nexus-border rounded-xl px-3.5 py-2.5 text-sm text-nexus-text outline-none"
                    disabled
                  />
                  <button
                    className="shrink-0 p-2.5 bg-blue-600 text-white rounded-xl opacity-40 cursor-not-allowed"
                    disabled
                    aria-label="Send unavailable"
                  >
                    <IconSend size={18} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty state — no conversation selected */
          <div className="flex-1 flex-col items-center justify-center text-center gap-3 hidden md:flex">
            <div className="w-16 h-16 rounded-full bg-nexus-hover flex items-center justify-center">
              <IconMessage size={26} className="text-nexus-muted/70" />
            </div>
            <p className="text-sm font-medium text-nexus-text-secondary">
              Select a conversation
            </p>
            <p className="text-xs text-nexus-muted max-w-[260px]">
              Choose a conversation from the list to view the message history
              and reply.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
