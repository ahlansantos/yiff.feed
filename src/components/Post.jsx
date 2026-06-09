"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import NsfwMedia from "./NsfwMedia";
import Avatar from "./ui/Avatar";
import SpeciesBadge from "./ui/SpeciesBadge";
import { cn, timeAgo } from "@/lib/utils";

export default function Post({ post, currentUserId, onAuthRequired }) {
  const [likes, setLikes] = useState(post.likes_count || 0);
  const [liked, setLiked] = useState(post.user_liked || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const supabase = createClient();

  const profile = post.profiles;
  const username = profile?.username || "unknown";
  const displayName = profile?.fursona_name || profile?.username || "Unknown";
  const species = profile?.fursona_species;

  async function toggleLike() {
    if (!currentUserId) {
      onAuthRequired?.();
      return;
    }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikes((l) => l + (newLiked ? 1 : -1));

    if (newLiked) {
      await supabase.from("likes").insert({ user_id: currentUserId, post_id: post.id });
    } else {
      await supabase.from("likes").delete().eq("user_id", currentUserId).eq("post_id", post.id);
    }
  }

  async function loadComments() {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setLoadingComments(true);
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url, fursona_name)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    setComments(data || []);
    setShowComments(true);
    setLoadingComments(false);
  }

  async function submitComment(e) {
    e?.preventDefault();
    if (!commentText.trim()) return;
    if (!currentUserId) {
      onAuthRequired?.();
      return;
    }
    const { data } = await supabase
      .from("comments")
      .insert({ post_id: post.id, user_id: currentUserId, content: commentText.trim() })
      .select("*, profiles(username, avatar_url, fursona_name)")
      .single();
    if (data) {
      setComments((c) => [...c, data]);
      setCommentsCount((n) => n + 1);
    }
    setCommentText("");
  }

  return (
    <article className="surface p-4">
      <div className="flex gap-3">
          <Link href={`/profile/${username}`} className="shrink-0 mt-0.5" tabIndex={-1}>
            <Avatar src={profile?.avatar_url} alt={username} size={44} />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <Link
                href={`/profile/${username}`}
                className="font-semibold text-sm hover:underline underline-offset-2"
              >
                {displayName}
              </Link>
              <SpeciesBadge species={species} />
              <span className="text-muted-foreground text-xs">@{username}</span>
              <span className="text-muted-foreground text-xs ml-auto">
                {timeAgo(post.created_at)}
              </span>
            </div>

            {post.content && (
              <p className="text-sm leading-relaxed mb-3 whitespace-pre-wrap break-words">
                {post.content}
              </p>
            )}

            {post.media_url && post.media_type === "image" && (
              <NsfwMedia isNsfw={post.is_nsfw} className="mb-3 rounded-lg">
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={post.media_url}
                    alt=""
                    className="w-full max-h-[500px] object-cover"
                    loading="lazy"
                  />
                </div>
              </NsfwMedia>
            )}

            {post.media_url && post.media_type === "video" && (
              <NsfwMedia isNsfw={post.is_nsfw} className="mb-3 rounded-lg">
                <div className="rounded-lg overflow-hidden border border-border bg-black">
                  <video src={post.media_url} controls className="w-full max-h-[500px]" playsInline />
                </div>
              </NsfwMedia>
            )}

            {post.is_nsfw && !post.media_url && (
              <span className="inline-block text-xs px-2 py-0.5 rounded-full border border-destructive/40 text-destructive font-medium mb-2">
                18+
              </span>
            )}

            <div className="flex gap-1 mt-1 pt-2 border-t border-border">
              <button
                onClick={toggleLike}
                className={cn(
                  "flex items-center gap-1.5 text-xs px-2 py-1 rounded-md transition-colors active:scale-95",
                  liked
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>{liked ? "♥" : "♡"}</span>
                <span className="font-medium tabular-nums">{likes}</span>
              </button>

              <button
                onClick={loadComments}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors px-2 py-1 rounded-md"
              >
                <span>💬</span>
                <span className="font-medium tabular-nums">
                  {loadingComments ? "..." : commentsCount}
                </span>
              </button>

              <button
                onClick={() =>
                  navigator.clipboard?.writeText(`${window.location.origin}/profile/${username}`)
                }
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors px-2 py-1 rounded-md ml-auto"
              >
                <span>↗</span>
                <span className="hidden sm:inline">Share</span>
              </button>
            </div>

            {showComments && (
              <div className="mt-3 flex flex-col gap-2 pt-2 border-t border-border">
                {comments.length === 0 && (
                  <p className="text-xs text-muted-foreground py-2">No comments yet. Be the first!</p>
                )}
                {comments.map((c) => (
                  <div key={c.id} className="flex gap-2 items-start">
                    <Avatar src={c.profiles?.avatar_url} size={24} className="mt-0.5" />
                    <div className="flex-1 bg-muted rounded-lg px-3 py-2">
                      <span className="text-xs font-semibold mr-1.5">
                        {c.profiles?.fursona_name || c.profiles?.username}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.content}</span>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 mt-1">
                  <input
                    className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring transition-shadow"
                    placeholder="Add a comment..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitComment()}
                  />
                  <button
                    onClick={submitComment}
                    disabled={!commentText.trim()}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent text-accent-foreground transition-opacity disabled:opacity-40"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </article>
  );
}
