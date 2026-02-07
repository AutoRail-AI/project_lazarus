"use client"

import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { APP_NAME } from "@/lib/utils/constants"

export type LogoVariant = "default" | "on-dark" | "on-brand"

/** CSS filter to render icon as Cloud White - for purple gradient backgrounds (AAA contrast) */
const FILTER_ON_BRAND = "brightness(0) invert(1)"

/** CSS filter to render icon as Rail Purple (#6E18B3) - for Void Black backgrounds */
const FILTER_ON_DARK =
  "brightness(0) saturate(100%) invert(16%) sepia(63%) saturate(4848%) hue-rotate(274deg) brightness(91%) contrast(105%)"

export interface LogoProps {
  /** Variant controls icon and text colors for contrast on different backgrounds */
  variant?: LogoVariant
  /** Show the icon (default: true) */
  showIcon?: boolean
  /** Show the "Project Lazarus" text (default: true) */
  showText?: boolean
  /** Icon size in pixels (default: 32) */
  size?: 24 | 32 | 40
  /** Link href (default: "/"). Set to undefined for non-link */
  href?: string
  /** Optional className to wrap only the icon (e.g. glass container) */
  iconWrapperClassName?: string
  className?: string
}

const variantStyles = {
  default: {
    iconFilter: undefined,
    textClassName: "text-[#001320]",
  },
  "on-brand": {
    iconFilter: FILTER_ON_BRAND,
    textClassName: "text-[#FAFAFA]",
  },
  "on-dark": {
    iconFilter: FILTER_ON_DARK,
    textClassName: "text-rail-purple",
  },
} as const

export function Logo({
  variant = "default",
  showIcon = true,
  showText = true,
  size = 32,
  href = "/",
  iconWrapperClassName,
  className,
}: LogoProps) {
  const styles = variantStyles[variant]

  const iconEl = showIcon && (
    <span
      className={cn("flex shrink-0", iconWrapperClassName)}
      style={
        styles.iconFilter
          ? { filter: styles.iconFilter }
          : undefined
      }
    >
      <Image
            src="/icon.svg"
            alt={APP_NAME}
            width={size}
            height={size}
            className={cn(
              size === 24 && "h-6 w-6",
              size === 32 && "h-8 w-8",
              size === 40 && "h-10 w-10"
            )}
            priority
          />
    </span>
  )

  const content = (
    <>
      {iconEl}
      {showText && (
        <span
          className={cn(
            styles.textClassName,
            size === 24 && "text-2xl",
            size === 32 && "text-3xl",
            size === 40 && "text-4xl"
          )}
        >
          {APP_NAME.toLowerCase()}
        </span>
      )}
    </>
  )

  const baseClassName = cn(
    "inline-flex items-center gap-2 font-bold tracking-tight",
    !href && "cursor-default",
    className
  )

  if (href) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    )
  }

  return <div className={baseClassName}>{content}</div>
}
