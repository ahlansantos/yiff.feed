"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { Bell, UserPlus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { cn, timeAgo } from "@/lib/utils";

// Bell icon with an unread badge + a dropdown of notifications.
// Currently handles "follow" notifications; the shape is ready for
// likes/comments later.
export default function NotificationsBell({ userId, className }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const supabase = createClient();
  const channelRef = useRef(null);
  const wrapRef = useRef(null);

  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    if (!userId) return;
    load();

    channelRef.current?.unsubscribe();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => load()
      )
      .subscribe();
    channelRef.current = channel;

    return () => channel.unsubscribe();
  }, [userId]);

  // Close the dropdown on outside click.
  useEffect(() => {
    function onClick(e) {
      if (open && wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, type, read, created_at, actor:profiles!notifications_actor_id_fkey(username, fursona_name, avatar_url)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems(data || []);
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    // Opening marks everything read.
    if (next && unread > 0) {
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("read", false);
    }
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 max-h-96 overflow-y-auto surface p-1 z-50 shadow-xl">
          <div className="px-3 py-2 text-sm font-semibold border-b border-border">
            Notifications
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              No notifications yet
            </p>
          ) : (
            items.map((n) => (
              <Link
                key={n.id}
                href={`/profile/${n.actor?.username || ""}`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="relative shrink-0">
                  <Avatar src={n.actor?.avatar_url} size={36} />
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                    <UserPlus className="w-2.5 h-2.5" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug">
                    <span className="font-semibold">
                      {n.actor?.fursona_name || n.actor?.username || "Someone"}
                    </span>{" "}
                    started following you
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
