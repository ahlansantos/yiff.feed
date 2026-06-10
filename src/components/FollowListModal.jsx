"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import Avatar from "@/components/ui/Avatar";

// Modal listing a profile's followers or following.
// `mode` is "followers" | "following"; `profileId` is whose list to show.
export default function FollowListModal({ profileId, mode, onClose }) {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    (async () => {
      // followers -> people who follow this profile (join on follower)
      // following -> people this profile follows (join on following)
      const matchCol = mode === "followers" ? "following_id" : "follower_id";
      const joinCol = mode === "followers" ? "follower_id" : "following_id";

      const { data } = await supabase
        .from("follows")
        .select(
          `profile:profiles!follows_${joinCol}_fkey(id, username, fursona_name, fursona_species, avatar_url)`
        )
        .eq(matchCol, profileId)
        .limit(100);

      setPeople((data || []).map((r) => r.profile).filter(Boolean));
      setLoading(false);
    })();
  }, [profileId, mode]);

  const title = mode === "followers" ? "Followers" : "Following";

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="surface w-full max-w-sm max-h-[70vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          {loading ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Loading…
            </p>
          ) : people.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              {mode === "followers"
                ? "No followers yet"
                : "Not following anyone yet"}
            </p>
          ) : (
            people.map((p) => (
              <Link
                key={p.id}
                href={`/profile/${p.username}`}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
              >
                <Avatar src={p.avatar_url} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {p.fursona_name || p.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{p.username}
                    {p.fursona_species && ` · ${p.fursona_species}`}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
