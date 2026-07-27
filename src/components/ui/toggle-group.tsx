import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

function ToggleGroup({
  className,
  ...props
}: ComponentProps<typeof ToggleGroupPrimitive>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  ...props
}: ComponentProps<typeof TogglePrimitive>) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex min-h-8 items-center justify-center rounded-md border border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors duration-200 ease-in-out outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 data-pressed:border-border data-pressed:bg-background data-pressed:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
