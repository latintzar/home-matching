"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

// Placeholder chart component - recharts not available
export const Chart = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("chart-placeholder", className)}
        {...props}
      >
    Chart component not available
      </div>
))
Chart.displayName = "Chart"

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("chart-container", className)}
    {...props}
  />
))
ChartContainer.displayName = "ChartContainer"

export const ChartTooltip = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("chart-tooltip", className)}
    {...props}
  />
))
ChartTooltip.displayName = "ChartTooltip"

export const ChartTooltipContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("chart-tooltip-content", className)}
    {...props}
  />
))
ChartTooltipContent.displayName = "ChartTooltipContent"

export const ChartLegend = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("chart-legend", className)}
    {...props}
  />
))
ChartLegend.displayName = "ChartLegend"

export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("chart-legend-content", className)}
    {...props}
  />
))
ChartLegendContent.displayName = "ChartLegendContent"