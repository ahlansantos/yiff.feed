"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { withUserLikes } from "@/lib/posts";
import Post from "./Post";
import PostComposer from "./PostComposer";
import Card from "./ui/Card";

export default function Feed({ currentUser, mode, onAuthRequired }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const channelRef = useRef(null);

  useEffect(() => {
    loadPosts();
    subscribeRealtime();
    return () => { channelRef.current?.unsubscribe(); };
  }, [mode, currentUser?.id]);

  async function loadPosts() {
    setLoading(true);
    let query = supabase
      .from("posts")
      .select("*, profiles(username, avatar_url, fursona_name, fursona_species)")
      .is("repost_of", null)
      .order("created_at", { ascending: false })
      .limit(40);

    if (mode === "following" && currentUser?.id) {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", currentUser.id);
      const ids = follows?.map((f) => f.following_id) || [];
      if (ids.length === 0) { setPosts([]); setLoading(false); return; }
      query = query.in("user_id", ids);
    }

    const { data } = await query;

    setPosts(await withUserLikes(data, currentUser?.id));
    setLoading(false);
  }

  function subscribeRealtime() {
    channelRef.current?.unsubscribe();
    const channel = supabase
      .channel("feed-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, async (payload) => {
        const { data: newPost } = await supabase
          .from("posts")
          .select("*, profiles(username, avatar_url, fursona_name, fursona_species)")
          .eq("id", payload.new.id)
          .single();
        if (newPost) setPosts((prev) => [{ ...newPost, likes_count: 0, comments_count: 0, user_liked: false }, ...prev]);
      })
      .subscribe();
    channelRef.current = channel;
  }

  function handleNewPost(post) {
    setPosts((p) => [{ ...post, likes_count: 0, comments_count: 0, user_liked: false }, ...p]);
  }

  if (loading) return (
    <div className="flex flex-col gap-4">
      {currentUser && <Card className="p-4 h-28 bg-muted animate-pulse" />}
      {[...Array(3)].map((_, i) => (
        <Card key={i} className="p-4 flex gap-3">
          <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 flex flex-col gap-2">
            <div className="h-3 rounded bg-muted animate-pulse w-32" />
            <div className="h-3 rounded bg-muted animate-pulse w-full" />
            <div className="h-3 rounded bg-muted animate-pulse w-3/4" />
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {currentUser && (
        <Card className="overflow-hidden">
          <PostComposer currentUser={currentUser} onPost={handleNewPost} />
        </Card>
      )}
      {posts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          {mode === "following" ? (
            <>
              <p className="text-base font-medium text-foreground">Your pack is quiet</p>
              <p className="text-sm text-center px-6">Follow other furries to see their posts here</p>
            </>
          ) : (
            <>
              <p className="text-base font-medium text-foreground">Be the first!</p>
              <p className="text-sm">No posts yet. Say hi</p>
            </>
          )}
        </Card>
      ) : (
        posts.map((post) => (
          <Post
            key={post.id}
            post={post}
            currentUserId={currentUser?.id}
            onAuthRequired={onAuthRequired}
          />
        ))
      )}
    </div>
  );
}
