"use client";
import { useEffect, useState, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { withUserLikes } from "@/lib/posts";
import { useComments } from "@/lib/useComments";
import Link from "next/link";
import NsfwMedia from "./NsfwMedia";
import Avatar from "./ui/Avatar";
import Card from "./ui/Card";
import { cn } from "@/lib/utils";

function VideoItem({ post, currentUserId, isActive, onAuthRequired }) {
  const videoRef = useRef();
  const [liked, setLiked] = useState(post.user_liked || false);
  const [likes, setLikes] = useState(post.likes_count || 0);
  const [playing, setPlaying] = useState(false);
  const [nsfwRevealed, setNsfwRevealed] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [commentText, setCommentText] = useState("");
  const supabase = createClient();
  const { comments, loaded, loading, submitting, loadComments, addComment } =
    useComments(post.id, { onCountChange: (d) => setCommentsCount((n) => n + d) });

  function openComments() {
    if (!loaded) loadComments();
    videoRef.current?.pause();
    setPlaying(false);
    setCommentsOpen(true);
  }

  async function handleSubmitComment() {
    if (!commentText.trim()) return;
    if (!currentUserId) {
      onAuthRequired?.();
      return;
    }
    const ok = await addComment(commentText, currentUserId);
    if (ok) setCommentText("");
  }

  useEffect(() => {
    if (!videoRef.current) return;
    if (isActive && (!post.is_nsfw || nsfwRevealed)) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [isActive, nsfwRevealed, post.is_nsfw]);

  function togglePlay() {
    if (post.is_nsfw && !nsfwRevealed) return;
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      setPlaying(true);
    }
  }

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

  const username = post.profiles?.username || "unknown";
  const species = post.profiles?.fursona_species;

  const videoEl = post.media_url ? (
    <video
      ref={videoRef}
      src={post.media_url}
      className="absolute inset-0 w-full h-full object-cover"
      loop
      playsInline
      muted={false}
      preload="none"
      onClick={togglePlay}
    />
  ) : null;

  return (
    <div className="video-snap relative h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] w-full flex items-center justify-center bg-black overflow-hidden rounded-lg">
      {post.media_url ? (
        post.is_nsfw && !nsfwRevealed ? (
          <NsfwMedia
            isNsfw
            className="absolute inset-0 w-full h-full"
            onReveal={() => setNsfwRevealed(true)}
          >
            {videoEl}
          </NsfwMedia>
        ) : (
          videoEl
        )
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-foreground text-xl font-semibold text-center px-8 max-w-md leading-relaxed">
            {post.content}
          </p>
        </div>
      )}

      {post.is_nsfw && nsfwRevealed && (
        <button
          onClick={() => {
            setNsfwRevealed(false);
            videoRef.current?.pause();
            setPlaying(false);
          }}
          className="absolute top-4 left-4 z-10 text-xs px-2 py-1 rounded-full bg-black/60 text-white backdrop-blur-sm"
        >
          Hide 18+
        </button>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20 pointer-events-none" />

      {!playing && post.media_url && (!post.is_nsfw || nsfwRevealed) && (
        <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
          <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center text-white text-3xl backdrop-blur-sm">
            ▶
          </div>
        </div>
      )}
      {post.media_url && playing && (!post.is_nsfw || nsfwRevealed) && (
        <div className="absolute inset-0 cursor-pointer" onClick={togglePlay} />
      )}

      <div className="absolute right-4 bottom-20 flex flex-col gap-5 items-center z-10">
        <Link href={`/profile/${username}`}>
          <Avatar
            src={post.profiles?.avatar_url}
            alt={username}
            size={48}
            className="ring-2 ring-white/70"
          />
        </Link>

        <button onClick={toggleLike} className="flex flex-col items-center gap-1">
          <span
            className={cn(
              "text-3xl transition-transform active:scale-125",
              liked ? "text-accent" : "text-white"
            )}
          >
            {liked ? "♥" : "♡"}
          </span>
          <span className="text-white text-xs font-semibold tabular-nums">{likes}</span>
        </button>

        <button onClick={openComments} className="flex flex-col items-center gap-1">
          <span className="text-3xl text-white">💬</span>
          <span className="text-white text-xs font-semibold tabular-nums">
            {commentsCount}
          </span>
        </button>

        <button
          onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/profile/${username}`)}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-3xl text-white">↗</span>
          <span className="text-white text-xs font-semibold">Share</span>
        </button>
      </div>

      <div className="absolute left-4 right-20 bottom-6 z-10">
        <Link href={`/profile/${username}`} className="flex items-center gap-2 mb-2">
          <span className="text-white font-bold text-sm">@{username}</span>
          {species && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
              {species}
            </span>
          )}
          {post.is_nsfw && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/80 text-white">18+</span>
          )}
        </Link>
        {post.content && (
          <p className="text-white/90 text-sm leading-relaxed line-clamp-3">{post.content}</p>
        )}
      </div>

      {commentsOpen && (
        <div className="absolute inset-0 z-20 flex flex-col justify-end">
          <button
            aria-label="Close comments"
            className="absolute inset-0 bg-black/50"
            onClick={() => setCommentsOpen(false)}
          />
          <div className="relative bg-card border-t border-border rounded-t-2xl max-h-[70%] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold">
                {commentsCount} {commentsCount === 1 ? "comment" : "comments"}
              </span>
              <button
                onClick={() => setCommentsOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {loading && !loaded ? (
                <p className="text-xs text-muted-foreground py-2">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  No comments yet. Be the first!
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex gap-2 items-start">
                    <Avatar src={c.profiles?.avatar_url} size={24} className="mt-0.5" />
                    <div className="flex-1 bg-muted rounded-lg px-3 py-2">
                      <span className="text-xs font-semibold mr-1.5">
                        {c.profiles?.fursona_name || c.profiles?.username}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.content}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 p-3 border-t border-border">
              <input
                className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring transition-shadow"
                placeholder={currentUserId ? "Add a comment..." : "Log in to comment"}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmitComment()}
              />
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim() || submitting}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-accent text-accent-foreground transition-opacity disabled:opacity-40"
              >
                {submitting ? "…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VideoFeed({ currentUser, onAuthRequired }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef();
  const supabase = createClient();

  useEffect(() => {
    loadVideos();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveIndex(parseInt(entry.target.dataset.index));
          }
        });
      },
      { threshold: 0.6 }
    );

    container.querySelectorAll("[data-index]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [posts]);

  async function loadVideos() {
    const { data } = await supabase
      .from("posts")
      .select("*, profiles(username, avatar_url, fursona_name, fursona_species)")
      .eq("media_type", "video")
      .order("created_at", { ascending: false })
      .limit(20);

    setPosts(await withUserLikes(data, currentUser?.id));
    setLoading(false);
  }

  if (loading) {
    return (
      <Card className="flex items-center justify-center h-[calc(100vh-12rem)] text-muted-foreground text-sm">
        Loading…
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center h-[calc(100vh-12rem)] gap-3 text-muted-foreground">
        <p className="text-base font-medium text-foreground">No shorts yet</p>
        <p className="text-sm text-center max-w-xs">Post a short video to show up here</p>
      </Card>
    );
  }

  return (
    <div ref={containerRef} className="video-feed h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] rounded-lg overflow-hidden">
      {posts.map((post, i) => (
        <div key={post.id} data-index={i}>
          <VideoItem
            post={post}
            currentUserId={currentUser?.id}
            isActive={activeIndex === i}
            onAuthRequired={onAuthRequired}
          />
        </div>
      ))}
    </div>
  );
}
