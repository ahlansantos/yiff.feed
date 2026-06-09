import { createClient } from "@/lib/supabase";

// Upload limits
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

// Validates a user-selected file before upload. Returns an error
// string if rejected, or null if the file is allowed.
export function validateUploadFile(file) {
  if (!file) return "No file selected";
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) return "Only images and videos are allowed";

  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return `${isVideo ? "Video" : "Image"} must be under ${mb} MB`;
  }
  return null;
}

// Attaches `user_liked` to a list of posts that already carry
// `likes_count` / `comments_count` (maintained by DB triggers).
//
// Replaces the old pattern of fetching EVERY likes/comments row just
// to count them. Counts now come straight off the post row; the only
// extra query is a single scoped lookup of which of these posts the
// current user has liked (skipped entirely when logged out).
export async function withUserLikes(posts, currentUserId) {
  if (!posts || posts.length === 0) return [];

  let likedSet = new Set();
  if (currentUserId) {
    const supabase = createClient();
    const postIds = posts.map((p) => p.id);
    const { data: userLikes } = await supabase
      .from("likes")
      .select("post_id")
      .eq("user_id", currentUserId)
      .in("post_id", postIds);
    likedSet = new Set(userLikes?.map((l) => l.post_id) || []);
  }

  return posts.map((p) => ({
    ...p,
    likes_count: p.likes_count ?? 0,
    comments_count: p.comments_count ?? 0,
    user_liked: likedSet.has(p.id),
  }));
}
