import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("max-w-full animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
