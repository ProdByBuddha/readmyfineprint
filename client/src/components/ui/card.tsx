import * as React from "react"

import { cn } from "@/lib/utils"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'elevated' | 'interactive' | 'glass'
    hover?: boolean
  }
>(({ className, variant = 'default', hover = true, ...props }, ref) => {
  const cardVariants = {
    default: "rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm text-card-foreground shadow-md",
    elevated: "rounded-xl border border-border/30 bg-card shadow-lg hover:shadow-xl backdrop-blur-sm",
    interactive: "rounded-xl border border-border/50 bg-card/90 shadow-md hover:shadow-xl hover:border-primary/20 cursor-pointer transition-all duration-300 ease-out hover:-translate-y-1 backdrop-blur-sm",
    glass: "rounded-xl border border-white/10 bg-white/5 dark:bg-white/5 backdrop-blur-md shadow-xl text-card-foreground"
  }
  
  return (
    <div
      ref={ref}
      className={cn(
        cardVariants[variant],
        hover && variant !== 'interactive' && "transition-all duration-300 ease-out hover:shadow-lg",
        "group relative overflow-hidden",
        className
      )}
      {...props}
    />
  )
})
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-2 p-6 pb-3", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-xl font-bold leading-tight tracking-tight text-foreground",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-foreground-secondary leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-6 py-3", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center justify-between px-6 py-4 pt-2 border-t border-border/30 bg-muted/20", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
