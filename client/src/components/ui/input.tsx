import * as React from "react"

import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  success?: boolean
  variant?: 'default' | 'ghost' | 'filled'
  inputSize?: 'sm' | 'default' | 'lg'
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'false' | 'true' | 'grammar' | 'spelling'
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, success, variant = 'default', inputSize = 'default', ...props }, ref) => {
    const baseStyles = "flex w-full rounded-lg border backdrop-blur-sm transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground"
    
    const variantStyles = {
      default: "border-border bg-background/80 hover:bg-background focus-visible:bg-background shadow-sm hover:shadow-md focus-visible:shadow-md",
      ghost: "border-transparent bg-muted/50 hover:bg-muted/80 focus-visible:bg-background focus-visible:border-border shadow-none",
      filled: "border-border/50 bg-muted hover:bg-muted/80 focus-visible:bg-background focus-visible:border-border shadow-sm"
    }
    
    const sizeStyles = {
      sm: "h-9 px-3 py-2 text-xs",
      default: "h-11 px-4 py-3 text-sm",
      lg: "h-12 px-5 py-4 text-base"
    }
    
    const stateStyles = cn(
      error && "border-destructive/60 bg-destructive/5 focus-visible:ring-destructive focus-visible:border-destructive",
      success && "border-success/60 bg-success/5 focus-visible:ring-success focus-visible:border-success",
      !error && !success && "focus-visible:ring-primary focus-visible:border-primary/50"
    )
    
    return (
      <input
        type={type}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[inputSize],
          stateStyles,
          "text-foreground placeholder:text-muted-foreground",
          className
        )}
        ref={ref}
        aria-invalid={error || props['aria-invalid']}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
