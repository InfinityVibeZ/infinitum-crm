"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconSend,
  IconUser,
  IconBrandInstagram,
  IconBrandFacebook,
  IconMessage,
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

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    // IMPORTANT:
    // Immediately clear the previous conversation's messages.
    setMessages([]);

    fetchMessages(selectedConversation.id);

    if (
      selectedConversation.status === "UNREAD" ||
      isUnread(selectedConversation)
    ) {
      markAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/inbox/conversations");

      if (!res.ok) {
        throw new Error(`Failed to fetch conversations: ${res.status}`);
      }

      const data = await res.json();

      if (data.conversations) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error("Failed to fetch conversations", error);
    } finally {
      setLoading(false);
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

  const isUnread = (conv: Conversation) => {
    if (!conv.last_message_at) return false;

    const lastMsgDate = new Date(conv.last_message_at);
    const lastReadAt = conv.metadata?.lastReadAt;

    if (!lastReadAt) return true;

    return new Date(lastReadAt) < lastMsgDate;
  };

  const renderChannelIcon = (channel: string) => {
    switch (channel.toUpperCase()) {
      case "INSTAGRAM":
        return (
          <IconBrandInstagram
            size={16}
            className="text-pink-500"
          />
        );

      case "FACEBOOK":
        return (
          <IconBrandFacebook
            size={16}
            className="text-blue-500"
          />
        );

      default:
        return (
          <IconMessage
            size={16}
            className="text-gray-400"
          />
        );
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

  return (
    <div className="flex h-full bg-nexus-bg">
      {/* Sidebar: Conversation List */}
      <div className="w-1/3 border-r border-nexus-border bg-nexus-card flex flex-col">
        <div className="p-4 border-b border-nexus-border">
          <h2 className="text-lg font-bold text-nexus-text">
            Inbox
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-nexus-muted">
              Loading...
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-nexus-muted">
              No conversations found
            </div>
          ) : (
            conversations.map((conv) => {
              const unread = isUnread(conv);
              const isSelected =
                selectedConversation?.id === conv.id;

              const instagramUsername =
                getInstagramUsername(conv);

              return (
                <div
                  key={conv.id}
                  onClick={() => {
                    if (selectedConversation?.id !== conv.id) {
                      setSelectedConversation(conv);
                    }
                  }}
                  className={`p-4 border-b border-nexus-border/50 cursor-pointer hover:bg-nexus-hover transition-colors ${
                    isSelected
                      ? "bg-nexus-hover/80"
                      : ""
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center gap-2 font-semibold text-nexus-text">
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">
                          {conv.contact.name ||
                            "Unknown Contact"}
                        </span>

                        {instagramUsername && (
                          <span className="text-xs font-normal text-nexus-muted truncate">
                            @{instagramUsername}
                          </span>
                        )}
                      </div>

                      {renderChannelIcon(conv.channel)}
                    </div>

                    {unread && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1" />
                    )}
                  </div>

                  <div className="text-sm text-nexus-muted truncate">
                    {conv.messages?.[0]?.content ||
                      "No messages yet"}
                  </div>

                  <div className="text-xs text-nexus-muted/70 mt-2">
                    {conv.last_message_at
                      ? new Date(
                          conv.last_message_at
                        ).toLocaleString()
                      : ""}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Area: Chat Window */}
      <div className="w-2/3 flex flex-col bg-nexus-bg">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-nexus-border bg-nexus-card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-nexus-hover flex items-center justify-center">
                  <IconUser
                    size={20}
                    className="text-nexus-text"
                  />
                </div>

                <div>
                  <h3 className="font-bold text-nexus-text">
                    {selectedConversation.contact.name}
                  </h3>

                  {getInstagramUsername(
                    selectedConversation
                  ) && (
                    <div className="text-xs text-nexus-muted mb-1">
                      @
                      {getInstagramUsername(
                        selectedConversation
                      )}
                    </div>
                  )}

                  <div className="text-sm text-nexus-muted flex items-center gap-1">
                    {renderChannelIcon(
                      selectedConversation.channel
                    )}

                    <span className="capitalize">
                      {selectedConversation.channel.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messagesLoading ? (
                <div className="text-center text-nexus-muted">
                  Loading messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-nexus-muted">
                  No messages
                </div>
              ) : (
                messages.map((msg) => {
                  const isOutbound =
                    msg.direction === "OUTBOUND";

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${
                        isOutbound
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl p-3 ${
                          isOutbound
                            ? "bg-blue-600 text-white rounded-tr-sm"
                            : "bg-nexus-card text-nexus-text border border-nexus-border rounded-tl-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm">
                          {msg.content}
                        </p>

                        <div
                          className={`text-[10px] mt-1 text-right ${
                            isOutbound
                              ? "text-white/70"
                              : "text-nexus-muted"
                          }`}
                        >
                          {new Date(
                            msg.created_at
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 bg-nexus-card border-t border-nexus-border">
              <div
                className="flex items-center gap-2 opacity-50 cursor-not-allowed"
                title="Outbound messaging disabled in Phase 3.8.4"
              >
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) =>
                    setReplyText(e.target.value)
                  }
                  placeholder="Type a message... (Disabled in Phase 3.8.4)"
                  className="flex-1 bg-nexus-bg border border-nexus-border rounded-lg px-4 py-2 text-nexus-text outline-none"
                  disabled
                />

                <button
                  className="p-2 bg-blue-600 text-white rounded-lg"
                  disabled
                >
                  <IconSend size={20} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-nexus-muted flex-col gap-4">
            <IconMessage
              size={48}
              className="opacity-20"
            />
            <p>Select a conversation to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}