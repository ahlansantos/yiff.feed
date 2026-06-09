import { cn } from "@/lib/utils";

export default function SpeciesBadge({ species, className }) {
  if (!species) return null;
  return (
    <span
      className={cn(
        "inline-block text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground",
        className
      )}
    >
      {species}
    </span>
  );
}
