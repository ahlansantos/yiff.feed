"use client";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// Link to the DM inbox. (Per-message unread state isn't tracked yet, so
// there's no badge — easy to add later if we store a last-read marker.)
export default function MessagesLink({ className }) {
  return (
    <Link
      href="/messages"
      aria-label="Messages"
      className={cn(
        "p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors",
        className
      )}
    >
      <MessageCircle className="w-5 h-5" />
    </Link>
  );
}
