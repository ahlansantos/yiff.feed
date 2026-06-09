"use client";
import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import { validateUploadFile } from "@/lib/posts";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export default function PostComposer({ currentUser, onPost, autoOpen }) {
  const [content, setContent] = useState("");
  const [media, setMedia] = useState(null);
  const [isNsfw, setIsNsfw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef();
  const textRef = useRef();
  const supabase = createClient();

  // When the mobile "+" button bumps `autoOpen`, scroll the composer into
  // view, focus it, and pop the photo/video picker straight away.
  useEffect(() => {
    if (!autoOpen) return;
    textRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textRef.current?.focus();
    fileRef.current?.click();
  }, [autoOpen]);

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const validationError = validateUploadFile(file);
    if (validationError) {
      setError(validationError);
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setError(null);
    const type = file.type.startsWith("video") ? "video" : "image";
    const preview = URL.createObjectURL(file);
    setMedia({ file, preview, type });
  }

  function removeMedia() {
    setMedia(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function uploadMedia(file) {
    const ext = file.name.split(".").pop();
    const path = `${currentUser.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("posts-media").upload(path, file, { upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from("posts-media").getPublicUrl(path);
    return data.publicUrl;
  }

  async function handlePost() {
    if (!content.trim() && !media) return;
    setLoading(true);

    try {
      let media_url = null;
      let media_type = null;

      if (media) {
        setUploading(true);
        media_url = await uploadMedia(media.file);
        media_type = media.type;
        setUploading(false);
      }

      const { data } = await supabase
        .from("posts")
        .insert({
          user_id: currentUser.id,
          content: content.trim() || null,
          media_url,
          media_type,
          is_nsfw: isNsfw,
        })
        .select("*, profiles(username, avatar_url, fursona_name, fursona_species)")
        .single();

      if (data && onPost) onPost(data);
      setContent("");
      setMedia(null);
      setIsNsfw(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  const canPost = (content.trim() || media) && !loading;

  return (
    <div className="p-4">
      <div className="flex gap-3">
        <Avatar src={currentUser.avatar_url} size={40} className="mt-0.5" />

        <div className="flex-1 flex flex-col gap-3">
          <textarea
            id="compose-trigger"
            ref={textRef}
            className="bg-transparent resize-none outline-none text-sm placeholder:text-muted-foreground min-h-[72px] leading-relaxed"
            placeholder="What's on your mind?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={500}
          />

          {media && (
            <div className="relative rounded-lg overflow-hidden border border-border">
              {media.type === "image" ? (
                <img src={media.preview} alt="" className="w-full max-h-64 object-cover" />
              ) : (
                <video src={media.preview} className="w-full max-h-64" controls playsInline />
              )}
              <button
                onClick={removeMedia}
                className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white text-xs flex items-center justify-center hover:bg-black/90 transition-colors"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <div className="flex items-center gap-3 border-t border-border pt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
              id="media-upload"
            />            <label
              htmlFor="media-upload"
              className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
              title="Add image or video"
            >
              Media
            </label>

            <button
              onClick={() => setIsNsfw(!isNsfw)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium border transition-colors",
                isNsfw
                  ? "border-destructive/40 text-destructive"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              18+
            </button>

            {content.length > 0 && (
              <span
                className={cn(
                  "text-xs ml-auto mr-2 tabular-nums",
                  content.length > 450 ? "text-destructive" : "text-muted-foreground"
                )}
              >
                {500 - content.length}
              </span>
            )}

            <Button onClick={handlePost} disabled={!canPost} className={cn(content.length > 0 ? "" : "ml-auto")}>
              {uploading ? "Uploading..." : loading ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
