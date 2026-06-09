import { cn } from "@/lib/utils";

export default function Card({ className, children, ...props }) {
  return (
    <div className={cn("surface", className)} {...props}>
      {children}
    </div>
  );
}
