import { cn } from "@/lib/utils";

export default function Avatar({ src, alt = "", size = 40, className }) {
  return (
    <div
      className={cn(
        "rounded-full bg-muted overflow-hidden flex items-center justify-center shrink-0",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        "🐾"
      )}
    </div>
  );
}
