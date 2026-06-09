"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";

export default function RightPanel({ onAuthClick, currentUser }) {
  const [suggested, setSuggested] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadSuggested();
  }, [currentUser?.id]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => searchProfiles(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  async function loadSuggested() {
    const query = supabase
      .from("profiles")
      .select("id, username, fursona_name, fursona_species, avatar_url")
      .limit(5);

    if (currentUser?.id) {
      query.neq("id", currentUser.id);
    }

    const { data } = await query;
    setSuggested(data || []);
  }

  async function searchProfiles(q) {
    setSearching(true);
    const safe = q.replace(/[,()]/g, "").trim();
    const pattern = `%${safe}%`;
    const { data } = await supabase
      .from("profiles")
      .select("id, username, fursona_name, fursona_species, avatar_url")
      .or(`username.ilike.${pattern},fursona_name.ilike.${pattern}`)
      .limit(8);

    const filtered = currentUser?.id
      ? (data || []).filter((p) => p.id !== currentUser.id)
      : data || [];

    setSearchResults(filtered);
    setSearching(false);
  }

  async function follow(userId) {
    if (!currentUser) {
      onAuthClick("login");
      return;
    }
    if (userId === currentUser.id) return; // can't follow yourself
    await supabase.from("follows").insert({
      follower_id: currentUser.id,
      following_id: userId,
    });
    setSuggested((prev) => prev.filter((p) => p.id !== userId));
    setSearchResults((prev) => prev.filter((p) => p.id !== userId));
  }

  function ProfileRow({ profile }) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors rounded-lg">
        <Link href={`/profile/${profile.username}`}>
          <Avatar src={profile.avatar_url} size={36} />
        </Link>

        <div className="flex-1 min-w-0">
          <Link href={`/profile/${profile.username}`}>
            <p className="text-xs font-semibold truncate hover:underline">
              {profile.fursona_name || profile.username}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{profile.username}
              {profile.fursona_species && ` · ${profile.fursona_species}`}
            </p>
          </Link>
        </div>

        <Button variant="outline" size="sm" onClick={() => follow(profile.id)}>
          Follow
        </Button>
      </div>
    );
  }

  const showingSearch = searchQuery.trim().length > 0;

  return (
    <aside className="w-72 hidden lg:flex flex-col gap-4 sticky top-6 h-[calc(100vh-3rem)] overflow-y-auto">
      <Card className="p-3">
        <input
          className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-1 focus:ring-ring transition-shadow"
          placeholder="Search furries..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {showingSearch && (
          <div className="mt-2">
            {searching ? (
              <p className="text-xs text-muted-foreground text-center py-3">Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No furries found</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {searchResults.map((profile) => (
                  <ProfileRow key={profile.id} profile={profile} />
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {!showingSearch && suggested.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Suggested for you</h3>
          </div>
          <div className="flex flex-col p-1">
            {suggested.map((profile) => (
              <ProfileRow key={profile.id} profile={profile} />
            ))}
          </div>
        </Card>
      )}

      {!currentUser && !showingSearch && (
        <Card className="p-4 flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold mb-1">Join the pack</h3>
            <p className="text-xs text-muted-foreground">
              Meet furries, share art, post shorts, and more.
            </p>
          </div>
          <Button className="w-full" onClick={() => onAuthClick("register")}>
            Create free account
          </Button>
          <Button variant="outline" className="w-full" onClick={() => onAuthClick("login")}>
            I already have an account
          </Button>
        </Card>
      )}

      <p className="text-xs text-muted-foreground/60 text-center mt-auto pb-2">
        yiff.feed · for the furry community
      </p>
    </aside>
  );
}
