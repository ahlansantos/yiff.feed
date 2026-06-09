"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { cn, navItemClass } from "@/lib/utils";
import { NAV_TABS } from "@/lib/constants";
import Sidebar from "@/components/Sidebar";
import Feed from "@/components/Feed";
import VideoFeed from "@/components/VideoFeed";
import RightPanel from "@/components/RightPanel";
import AuthModal from "@/components/AuthModal";
import Card from "@/components/ui/Card";

export default function HomePage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("foryou");
  const [authModal, setAuthModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) loadProfile(nextUser.id);
      else setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadSession() {
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();
    setUser(sessionUser);
    if (sessionUser) await loadProfile(sessionUser.id);
    setLoading(false);
  }

  async function loadProfile(userId) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
  }

  function openAuth(mode) {
    setAuthModal(mode);
  }

  function changeTab(tab) {
    if (!user && tab === "following") {
      openAuth("login");
      return;
    }
    setActiveTab(tab);
  }

  const feedMode = activeTab === "following" ? "following" : "foryou";
  const tabLabel = NAV_TABS.find((t) => t.id === activeTab)?.label ?? "Feed";

  return (
    <div className="flex min-h-screen justify-center gap-6 px-4 py-4 md:py-6">
      <Sidebar
        user={user}
        profile={profile}
        onAuthClick={openAuth}
        activeTab={activeTab}
        onTabChange={changeTab}
      />

      <main className="flex-1 max-w-[560px] min-h-[calc(100vh-2rem)] flex flex-col gap-4 pb-20 md:pb-4">
        <header className="surface px-4 py-3 md:hidden flex items-center justify-between">
          <span className="text-lg font-semibold">yiff.feed</span>
        </header>

        <Card className="p-1.5 flex gap-1 md:hidden overflow-x-auto">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => changeTab(tab.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium",
                navItemClass(activeTab === tab.id)
              )}
            >
              {tab.label}
            </button>
          ))}
        </Card>

        <Card className="px-4 py-3 hidden md:flex items-center justify-between">
          <h2 className="text-base font-semibold">{tabLabel}</h2>
          <div className="flex gap-1">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => changeTab(tab.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium",
                  navItemClass(activeTab === tab.id)
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </Card>

        {loading ? (
          <Card className="flex items-center justify-center py-24 text-muted-foreground text-sm">
            Loading…
          </Card>
        ) : activeTab === "shorts" ? (
          <VideoFeed
            currentUser={profile || user}
            onAuthRequired={() => openAuth("login")}
          />
        ) : (
          <Feed
            currentUser={profile}
            mode={feedMode}
            onAuthRequired={() => openAuth("login")}
          />
        )}
      </main>

      <RightPanel onAuthClick={openAuth} currentUser={profile || user} />

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border flex px-2 py-1">
        {NAV_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => changeTab(tab.id)}
            className={cn(
              "flex-1 py-2 text-xs font-medium rounded-lg transition-colors",
              activeTab === tab.id
                ? "text-accent"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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
