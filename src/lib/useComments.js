"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase";

// Shared comment loading/posting for both Post and the Shorts feed.
// Keeps the Supabase calls in one place so they stay consistent.
export function useComments(postId, { onCountChange } = {}) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const supabase = createClient();

  async function loadComments() {
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("*, profiles(username, avatar_url, fursona_name)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    setComments(data || []);
    setLoaded(true);
    setLoading(false);
  }

  async function addComment(content, userId) {
    const text = content.trim();
    if (!text || !userId) return false;

    setSubmitting(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ post_id: postId, user_id: userId, content: text })
      .select("*, profiles(username, avatar_url, fursona_name)")
      .single();
    setSubmitting(false);

    if (error || !data) return false;

    setComments((c) => [...c, data]);
    onCountChange?.(1);
    return true;
  }

  return { comments, loaded, loading, submitting, loadComments, addComment };
}
