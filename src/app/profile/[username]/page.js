"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { withUserLikes, validateUploadFile } from "@/lib/posts";
import { cn } from "@/lib/utils";
import { SPECIES_OPTIONS } from "@/lib/constants";
import Post from "@/components/Post";
import AuthModal from "@/components/AuthModal";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import SpeciesBadge from "@/components/ui/SpeciesBadge";

export default function ProfilePage() {
  const { username } = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [authModal, setAuthModal] = useState(null);
  const [editing, setEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState(null);
  const [form, setForm] = useState({
    username: "",
    display_name: "",
    fursona_name: "",
    fursona_species: "",
  });
  const avatarInputRef = useRef(null);
  const supabase = createClient();

  const isOwnProfile = currentUser?.id === profile?.id;

  useEffect(() => {
    if (username) loadProfile();
  }, [username]);

  async function loadProfile() {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .single();

    if (!profileData) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(profileData);

    const [{ data: postsData }, { count: followers }, { count: following }] = await Promise.all([
      supabase
        .from("posts")
        .select("*, profiles(username, avatar_url, fursona_name, fursona_species)")
        .eq("user_id", profileData.id)
        .is("repost_of", null)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profileData.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profileData.id),
    ]);

    setFollowerCount(followers || 0);
    setFollowingCount(following || 0);

    setPosts(await withUserLikes(postsData, user?.id));

    if (user && user.id !== profileData.id) {
      const { data: followRow } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", profileData.id)
        .maybeSingle();
      setIsFollowing(!!followRow);
    }

    setLoading(false);
  }

  async function toggleFollow() {
    if (!currentUser) {
      setAuthModal("login");
      return;
    }
    if (currentUser.id === profile.id) return; // can't follow yourself

    if (isFollowing) {
      await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", profile.id);
      setIsFollowing(false);
      setFollowerCount((n) => n - 1);
    } else {
      await supabase.from("follows").insert({ follower_id: currentUser.id, following_id: profile.id });
      setIsFollowing(true);
      setFollowerCount((n) => n + 1);
    }
  }

  function startEditing() {
    setEditError(null);
    setForm({
      username: profile.username || "",
      display_name: profile.display_name || "",
      fursona_name: profile.fursona_name || "",
      fursona_species: profile.fursona_species || "",
    });
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setEditError(null);
  }

  async function saveProfile() {
    setEditError(null);

    const nextUsername = form.username.toLowerCase().trim();
    const nextDisplay = form.display_name.trim();
    const nextFursona = form.fursona_name.trim();
    const nextSpecies = form.fursona_species.trim();

    if (!nextUsername) {
      setEditError("Username can't be empty");
      return;
    }
    if (!/^[a-z0-9_]+$/.test(nextUsername)) {
      setEditError("Username can only use letters, numbers, and underscores");
      return;
    }

    setSavingEdit(true);

    // If the username changed, make sure it's not already taken.
    if (nextUsername !== profile.username) {
      const { data: taken } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", nextUsername)
        .neq("id", currentUser.id)
        .maybeSingle();
      if (taken) {
        setEditError("That username is already taken");
        setSavingEdit(false);
        return;
      }
    }

    const updates = {
      username: nextUsername,
      display_name: nextDisplay || null,
      fursona_name: nextFursona || null,
      fursona_species: nextSpecies || null,
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", currentUser.id);

    if (updateError) {
      // Unique-constraint violation is the most likely failure here.
      setEditError(
        updateError.code === "23505"
          ? "That username is already taken"
          : "Couldn't save changes, please try again"
      );
      setSavingEdit(false);
      return;
    }

    const usernameChanged = nextUsername !== profile.username;
    setProfile((p) => ({ ...p, ...updates }));
    setEditing(false);
    setSavingEdit(false);

    // The route is /profile/[username] — keep the URL in sync.
    if (usernameChanged) {
      router.replace(`/profile/${nextUsername}`);
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const validationError = validateUploadFile(file);
    if (validationError || !file.type.startsWith("image/")) {
      setAvatarError(validationError || "Avatar must be an image");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    setAvatarError(null);

    setUploadingAvatar(true);
    try {
      // Fixed path (no extension) so every re-upload overwrites the same
      // object — otherwise a .png then .jpg would leave two files and the
      // DB could point at a stale one. contentType keeps it served right.
      const path = `${currentUser.id}/avatar`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);

      // Persist a versioned URL in the DB so the new image survives a
      // refresh AND is seen by everyone (the ?v= busts the CDN cache for
      // all viewers, since the stored URL itself changes each upload).
      const versionedUrl = `${data.publicUrl}?v=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: versionedUrl })
        .eq("id", currentUser.id);
      if (updateError) throw updateError;

      setProfile((p) => ({ ...p, avatar_url: versionedUrl }));
    } catch (err) {
      console.error(err);
      setAvatarError("Upload failed, please try again");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground px-4">
        <p className="text-lg font-medium text-foreground">Profile not found</p>
        <Link href="/" className="text-sm text-accent hover:underline">
          ← Back to feed
        </Link>
      </div>
    );
  }

  const editInputClass =
    "flex-1 w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring transition-shadow";

  return (
    <div className="min-h-screen max-w-[560px] mx-auto px-4 py-4 pb-24 md:pb-6 flex flex-col gap-4">
      <Card className="px-4 py-3 flex items-center gap-3">
        <Link href="/" className="text-muted-foreground hover:text-foreground text-sm">←</Link>
        <div>
          <h1 className="font-semibold text-sm">{profile.fursona_name || profile.username}</h1>
          <p className="text-xs text-muted-foreground">{posts.length} posts</p>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar src={profile.avatar_url} size={80} />
            {isOwnProfile && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                  id="avatar-upload"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center cursor-pointer hover:opacity-90"
                  title="Change profile photo"
                >
                  {uploadingAvatar ? "…" : "✎"}
                </label>
              </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {editing ? (
              <p className="text-sm text-muted-foreground">Editing your profile</p>
            ) : (
              <>
                <h2 className="text-xl font-semibold truncate">
                  {profile.fursona_name || profile.username}
                </h2>
                {profile.display_name &&
                  profile.display_name !== profile.fursona_name && (
                    <p className="text-sm text-foreground/80 truncate">
                      {profile.display_name}
                    </p>
                  )}
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
                <SpeciesBadge species={profile.fursona_species} className="mt-2" />
              </>
            )}
          </div>
        </div>

        {avatarError && (
          <p className="text-xs text-destructive mt-3">{avatarError}</p>
        )}

        {editing ? (
          <div className="mt-5 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Username</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">@</span>
                <input
                  className={editInputClass}
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  placeholder="username"
                  autoCapitalize="none"
                />
              </div>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Display name</span>
              <input
                className={editInputClass}
                value={form.display_name}
                onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                placeholder="Your name"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Fursona name</span>
              <input
                className={editInputClass}
                value={form.fursona_name}
                onChange={(e) => setForm((f) => ({ ...f, fursona_name: e.target.value }))}
                placeholder="e.g. Kira"
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Species</span>
              <div className="flex flex-wrap gap-1.5">
                {SPECIES_OPTIONS.map((s) => {
                  const value = s.includes(" ") ? s.split(" ").slice(1).join(" ") : s;
                  const active = form.fursona_species === value;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, fursona_species: active ? "" : value }))
                      }
                      className={cn(
                        "text-xs px-2.5 py-1.5 rounded-full border transition-colors",
                        active
                          ? "border-accent text-accent"
                          : "border-border text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {editError && <p className="text-xs text-destructive">{editError}</p>}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveProfile} disabled={savingEdit}>
                {savingEdit ? "Saving…" : "Save"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={cancelEditing}
                disabled={savingEdit}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex gap-6 mt-5 text-sm">
              <span><strong>{posts.length}</strong> <span className="text-muted-foreground">posts</span></span>
              <span><strong>{followerCount}</strong> <span className="text-muted-foreground">followers</span></span>
              <span><strong>{followingCount}</strong> <span className="text-muted-foreground">following</span></span>
            </div>

            {isOwnProfile ? (
              <Button variant="outline" className="mt-4 w-full" onClick={startEditing}>
                Edit profile
              </Button>
            ) : (
              <Button
                className="mt-4 w-full"
                variant={isFollowing ? "outline" : "default"}
                onClick={toggleFollow}
              >
                {isFollowing ? "Following" : "Follow"}
              </Button>
            )}
          </>
        )}
      </Card>

      {posts.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <p className="text-sm">No posts yet</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {posts.map((post) => (
            <Post
              key={post.id}
              post={post}
              currentUserId={currentUser?.id}
              onAuthRequired={() => setAuthModal("login")}
            />
          ))}
        </div>
      )}

      {authModal && (
        <AuthModal
          mode={authModal}
          onClose={() => setAuthModal(null)}
          onSwitch={setAuthModal}
        />
      )}
    </div>
  );
}
