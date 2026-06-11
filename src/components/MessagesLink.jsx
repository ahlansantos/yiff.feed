"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Link to the DM inbox with an unread badge.
// Counts conversations where the last message is newer than the user's
// last-read timestamp (stored in conversations.user_a_read_at / user_b_read_at).
export default function MessagesLink({ userId, className }) {
  const [unread, setUnread] = useState(0);
  const supabase = useRef(createClient()).current;
  const channelRef = useRef(null);

  const loadUnread = useCallback(async () => {
    if (!userId) return;

    // Pull every conversation the user is part of (RLS handles filtering).
    const { data: convos } = await supabase
      .from("conversations")
      .select("id, user_a, user_b, last_message_at, user_a_read_at, user_b_read_at");

    if (!convos?.length) { setUnread(0); return; }

    let count = 0;
    for (const c of convos) {
      const myReadAt = c.user_a === userId ? c.user_a_read_at : c.user_b_read_at;
      // Unread if the conversation has a newer message than the last time
      // the user marked it read (or if they've never read it at all).
      if (!myReadAt || new Date(c.last_message_at) > new Date(myReadAt)) {
        // Only count if the last message was NOT from the current user.
        const { data: lastMsg } = await supabase
          .from("messages")
          .select("sender_id")
          .eq("conversation_id", c.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (lastMsg && lastMsg.sender_id !== userId) count++;
      }
    }
    setUnread(count);
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) return;
    loadUnread();

    channelRef.current?.unsubscribe();
    const channel = supabase
      .channel(`messages-unread-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `user_a=eq.${userId}`,
        },
        () => loadUnread()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `user_b=eq.${userId}`,
        },
        () => loadUnread()
      )
      .subscribe();
    channelRef.current = channel;

    return () => channel.unsubscribe();
  }, [userId, loadUnread, supabase]);

  return (
    <Link
      href="/messages"
      aria-label="Messages"
      className={cn(
        "relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className
      )}
    >
      <MessageCircle className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}