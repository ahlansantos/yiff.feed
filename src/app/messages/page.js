"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import {
  loadConversations,
  loadMessages,
  sendMessage,
  markConversationRead,
} from "@/lib/dm";
import { cn, timeAgo } from "@/lib/utils";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";

function MessagesInner() {
  // Stable Supabase client — never recreated across renders.
  const supabase = useRef(createClient()).current;
  const router = useRouter();
  const searchParams = useSearchParams();
  // ?c=<conversationId> opens a specific thread.
  const activeId = searchParams.get("c");

  const [me, setMe] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef(null);
  const bottomRef = useRef(null);

  const active = conversations.find((c) => c.id === activeId) || null;

  // Auth + conversation list.
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/");
        return;
      }
      setMe(user);
      const convos = await loadConversations(supabase, user.id);
      setConversations(convos);
      setLoading(false);
    })();
  }, [supabase, router]);

  // Load + subscribe to the active thread.
  useEffect(() => {
    if (!activeId || !me) return;
    let cancelled = false;

    (async () => {
      const msgs = await loadMessages(supabase, activeId);
      if (!cancelled) setMessages(msgs);
      // Mark conversation read when the user opens it.
      await markConversationRead(supabase, activeId, me.id);
    })();

    channelRef.current?.unsubscribe();
    const channel = supabase
      .channel(`messages-${activeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${activeId}`,
        },
        async (payload) => {
          setMessages((prev) =>
            prev.some((m) => m.id === payload.new.id)
              ? prev
              : [...prev, payload.new]
          );
          // If the incoming message is from the other user, mark it read.
          if (payload.new.sender_id !== me.id) {
            await markConversationRead(supabase, activeId, me.id);
          }
        }
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      channel.unsubscribe();
    };
  }, [activeId, me, supabase]);

  // Keep the thread scrolled to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeId]);

  async function handleSend() {
    if (!draft.trim() || !active || sending) return;
    setSending(true);
    const text = draft;
    setDraft("");
    try {
      const msg = await sendMessage(supabase, active.id, me.id, text);
      if (msg) {
        // Optimistically append (realtime echo is de-duped by id).
        setMessages((prev) =>
          prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
        );
        // Move this conversation to the top of the list.
        setConversations((prev) => {
          const updated = prev.map((c) =>
            c.id === active.id
              ? { ...c, lastMessage: msg, last_message_at: msg.created_at }
              : c
          );
          return [...updated].sort(
            (a, b) =>
              new Date(b.last_message_at) - new Date(a.last_message_at)
          );
        });
      }
    } catch (err) {
      console.error(err);
      setDraft(text); // restore on failure
    } finally {
      setSending(false);
    }
  }

  function openConversation(id) {
    router.push(`/messages?c=${id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-[920px] mx-auto px-3 py-4 pb-24 md:pb-6">
      <div className="flex gap-3 h-[calc(100vh-7rem)]">
        {/* Conversation list — hidden on mobile when a thread is open */}
        <Card
          className={cn(
            "w-full md:w-72 shrink-0 overflow-hidden flex flex-col",
            active && "hidden md:flex"
          )}
        >
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <h1 className="text-sm font-semibold">Messages</h1>
          </div>

          <div className="flex-1 overflow-y-auto p-1">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-10 px-4">
                No conversations yet. Visit someone&apos;s profile and tap
                Message to start one.
              </p>
            ) : (
              conversations.map((c) => {
                const hasUnread =
                  c.lastMessage &&
                  c.lastMessage.sender_id !== me?.id &&
                  (!c.myReadAt ||
                    new Date(c.last_message_at) > new Date(c.myReadAt));
                return (
                  <button
                    key={c.id}
                    onClick={() => openConversation(c.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                      c.id === activeId ? "bg-muted" : "hover:bg-muted"
                    )}
                  >
                    <Avatar src={c.other?.avatar_url} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-xs truncate", hasUnread ? "font-bold" : "font-semibold")}>
                        {c.other?.fursona_name || c.other?.username}
                      </p>
                      <p className={cn("text-xs truncate", hasUnread ? "text-foreground font-medium" : "text-muted-foreground")}>
                        {c.lastMessage?.content || "Say hi 👋"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {c.lastMessage && (
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {timeAgo(c.lastMessage.created_at)}
                        </span>
                      )}
                      {hasUnread && (
                        <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </Card>

        {/* Thread */}
        <Card
          className={cn(
            "flex-1 flex flex-col overflow-hidden",
            !active && "hidden md:flex"
          )}
        >
          {!active ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Pick a conversation
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                <button
                  onClick={() => router.push("/messages")}
                  className="md:hidden text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <Link
                  href={`/profile/${active.other?.username}`}
                  className="flex items-center gap-2 min-w-0"
                >
                  <Avatar src={active.other?.avatar_url} size={32} />
                  <span className="text-sm font-semibold truncate">
                    {active.other?.fursona_name || active.other?.username}
                  </span>
                </Link>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
                {messages.map((m) => {
                  const mine = m.sender_id === me.id;
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm break-words",
                        mine
                          ? "self-end bg-accent text-accent-foreground rounded-br-md"
                          : "self-start bg-muted rounded-bl-md"
                      )}
                    >
                      {m.content}
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-border p-3 flex items-center gap-2">
                <input
                  className="flex-1 bg-muted rounded-full px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Message…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!draft.trim() || sending}
                  aria-label="Send"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
          Loading…
        </div>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}