"use client"

import * as React from "react"
import { MinusIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Placeholder OTP input component - input-otp not available
export const InputOTP = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("otp-input-placeholder", className)}
    {...props}
  >
    OTP Input not available
  </div>
))
InputOTP.displayName = "InputOTP"

export const InputOTPGroup = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("otp-group", className)}
    {...props}
  />
))
InputOTPGroup.displayName = "InputOTPGroup"

export const InputOTPSlot = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn("otp-slot", className)}
    {...props}
  />
))
InputOTPSlot.displayName = "InputOTPSlot"

export const InputOTPSeparator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("otp-separator", className)}
    {...props}
  >
    <MinusIcon />
  </div>
))
InputOTPSeparator.displayName = "InputOTPSeparator"