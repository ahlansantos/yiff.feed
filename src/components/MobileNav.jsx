"use client";
import Link from "next/link";
import { Home, Clapperboard, Users, Plus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

// Bottom navigation, mobile only. Five slots:
//   Home (Discover) · Shorts · [ + post ] · Pack · You (pfp -> Den)
export default function MobileNav({
  user,
  profile,
  activeTab,
  onTabChange,
  onCompose,
  onAuthClick,
}) {
  function go(tab) {
    if (!user && tab === "following") {
      onAuthClick("login");
      return;
    }
    onTabChange(tab);
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-card border-t border-border">
      <div className="flex items-end justify-around px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <NavBtn
          label="Home"
          active={activeTab === "foryou"}
          onClick={() => go("foryou")}
          icon={<Home className="w-5 h-5" />}
        />
        <NavBtn
          label="Shorts"
          active={activeTab === "shorts"}
          onClick={() => go("shorts")}
          icon={<Clapperboard className="w-5 h-5" />}
        />

        {/* Raised compose button */}
        <button
          onClick={onCompose}
          aria-label="New post"
          className="flex-1 flex justify-center -mt-5"
        >
          <span className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg shadow-accent/30 active:scale-95 transition-transform">
            <Plus className="w-6 h-6" />
          </span>
        </button>

        <NavBtn
          label="Pack"
          active={activeTab === "following"}
          onClick={() => go("following")}
          icon={<Users className="w-5 h-5" />}
        />

        {/* You — pfp links to your den, or opens auth if logged out */}
        {user && profile ? (
          <Link
            href={`/profile/${profile.username}`}
            className="flex-1 flex flex-col items-center gap-0.5 py-1 text-muted-foreground"
          >
            <Avatar
              src={profile.avatar_url}
              size={24}
              className="ring-1 ring-border"
            />
            <span className="text-[10px] font-medium leading-none">You</span>
          </Link>
        ) : (
          <NavBtn
            label="You"
            active={false}
            onClick={() => onAuthClick("login")}
            icon={<Avatar src={null} size={24} />}
          />
        )}
      </div>
    </nav>
  );
}

function NavBtn({ label, active, onClick, icon }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-0.5 py-1 transition-colors",
        active ? "text-accent" : "text-muted-foreground"
      )}
    >
      {icon}
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </button>
  );
}
