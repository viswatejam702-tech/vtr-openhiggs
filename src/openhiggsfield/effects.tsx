"use client";

import React, { useEffect, useState } from "react";
import { ImageGeneration as ImgGenBase } from "img-fx";
import { BorderBeam as BorderBeamBase } from "border-beam";
import { ThinkingOrb as ThinkingOrbBase } from "thinking-orbs";
import {
  MetalFx as MetalFxBase,
  MetalText as MetalTextBase,
  MetalBadge as MetalBadgeBase,
  useMetalBend,
  useMetalTextReflection,
} from "metal-fx";

export { useMetalBend, useMetalTextReflection };

/**
 * Client-mounted guard to ensure WebGL/Canvas effects only initialize
 * on the browser (preventing any Next.js SSR hydration mismatches).
 */
export function ClientOnly({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}

/**
 * Image generation WebGL pixel-mosaic shader loader resolving into real image.
 * Libraries.dev img-fx
 */
export function ImageGeneration({
  preset = "pixels-organic",
  images,
  autoReveal = true,
  children,
  className,
  style,
}: {
  preset?: "pixels-organic" | "pixels-mechanic" | "sweep-gradient";
  images: string[];
  autoReveal?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <ClientOnly fallback={children}>
      <ImgGenBase
        preset={preset}
        images={images}
        autoReveal={autoReveal}
        className={className}
        style={style}
      >
        {children}
      </ImgGenBase>
    </ClientOnly>
  );
}

/**
 * Traveling or breathing border glow beam effect.
 * Libraries.dev border-beam
 */
export function BorderBeam({
  size = "md",
  colorVariant = "colorful",
  strength = 0.7,
  active = true,
  theme = "dark",
  children,
  className,
}: {
  size?: "md" | "sm" | "line" | "pulse-inner" | "pulse-outside";
  colorVariant?: "colorful" | "mono" | "ocean" | "sunset";
  strength?: number;
  active?: boolean;
  theme?: "light" | "dark";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ClientOnly fallback={children}>
      <BorderBeamBase
        size={size}
        colorVariant={colorVariant}
        strength={strength}
        active={active}
        theme={theme}
        className={className}
      >
        {children}
      </BorderBeamBase>
    </ClientOnly>
  );
}

/**
 * Dotted thought-orb loading indicators for AI states.
 * Libraries.dev thinking-orbs
 */
export function ThinkingOrb({
  state = "working",
  size = 64,
  speed = 1,
  dark = true,
  paused = false,
}: {
  state?:
    | "working"
    | "searching"
    | "solving"
    | "listening"
    | "connecting"
    | "weaving"
    | "composing"
    | "breathing"
    | "shaping";
  size?: 64 | 20;
  speed?: number;
  dark?: boolean;
  paused?: boolean;
}) {
  return (
    <ClientOnly fallback={<span className="ohf-spinner" style={{ width: size, height: size }} />}>
      <ThinkingOrbBase
        state={state}
        size={size}
        speed={speed}
        theme={dark ? "dark" : "light"}
        paused={paused}
      />
    </ClientOnly>
  );
}

/**
 * Real-time WebGL liquid-metal effect.
 * Libraries.dev metal-fx
 */
export function MetalFx({
  preset = "chromatic",
  variant = "button",
  strength = 1,
  theme = "dark",
  innerShadow = true,
  children,
}: {
  preset?: "chromatic" | "silver" | "gold";
  variant?: "button" | "circle";
  strength?: number;
  theme?: "light" | "dark";
  innerShadow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ClientOnly fallback={children}>
      <MetalFxBase
        preset={preset}
        variant={variant}
        strength={strength}
        theme={theme}
        innerShadow={innerShadow}
      >
        {children}
      </MetalFxBase>
    </ClientOnly>
  );
}

export function MetalText({
  font = "600 15px Inter",
  color = "#E2E2E2",
  children,
}: {
  font?: string;
  color?: string;
  children: string;
}) {
  return (
    <ClientOnly fallback={<span style={{ font, color }}>{children}</span>}>
      <MetalTextBase font={font} color={color}>
        {children}
      </MetalTextBase>
    </ClientOnly>
  );
}

export function MetalBadge({ children }: { children?: string }) {
  return (
    <ClientOnly fallback={<span className="ohf-metal-badge-fallback">{children}</span>}>
      <MetalBadgeBase>{children}</MetalBadgeBase>
    </ClientOnly>
  );
}
