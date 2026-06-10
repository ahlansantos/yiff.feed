"use client";
import { createClient } from "@/lib/supabase";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/ui/Avatar";
import Card from "@/components/ui/Card";
import NotificationsBell from "@/components/NotificationsBell";
import { cn, navItemClass } from "@/lib/utils";
import { NAV_TABS } from "@/lib/constants";

export default function Sidebar({ user, profile, onAuthClick, activeTab, onTabChange }) {
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
  }

  function selectTab(id) {
    if (!user && id === "following") {
      onAuthClick("login");
      return;
    }
    onTabChange(id);
  }

  return (
    <aside className="w-64 hidden md:flex flex-col gap-2 sticky top-6 h-[calc(100vh-3rem)]">
      <Card className="p-4 flex flex-col gap-1 flex-1">
        <Link href="/" className="px-2 mb-4">
          <span className="text-lg font-semibold block leading-tight">yiff.feed</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
            furry social
          </span>
        </Link>

        {NAV_TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => selectTab(item.id)}
            className={cn(
              "px-3 py-2.5 rounded-lg text-sm font-medium text-left w-full",
              navItemClass(activeTab === item.id)
            )}
          >
            {item.label}
          </button>
        ))}

        {user && profile && (
          <>
            <Link
              href={`/profile/${profile.username}`}
              className={cn(
                "px-3 py-2.5 rounded-lg text-sm font-medium",
                navItemClass(false)
              )}
            >
              My Den
            </Link>

            <Link
              href="/messages"
              className={cn(
                "px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2",
                navItemClass(false)
              )}
            >
              <MessageCircle className="w-4 h-4" />
              Messages
            </Link>

            <div
              className={cn(
                "px-1 py-1 rounded-lg text-sm font-medium flex items-center gap-1",
                navItemClass(false)
              )}
            >
              <NotificationsBell userId={user.id} />
              <span className="text-muted-foreground">Notifications</span>
            </div>
          </>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-4">
          {user && profile ? (
            <>
              <Button
                className="w-full"
                onClick={() => document.getElementById("compose-trigger")?.focus()}
              >
                New post
              </Button>

              <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-muted group">
                <Link
                  href={`/profile/${profile.username}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <Avatar src={profile.avatar_url} size={36} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate">
                      {profile.fursona_name || profile.username}
                    </span>
                    <span className="text-xs text-muted-foreground truncate">
                      @{profile.username}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded-md hover:bg-background transition-colors"
                >
                  log out
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-muted-foreground text-center mb-1">Join the pack</p>
              <Button className="w-full" onClick={() => onAuthClick("register")}>
                Sign up
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onAuthClick("login")}
              >
                Log in
              </Button>
            </div>
          )}
        </div>
      </Card>
    </aside>
  );
}
