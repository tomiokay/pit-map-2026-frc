"use client";

import type { FavoriteColor } from "@/lib/favoriteColors";

interface Props {
  active: boolean;
  onClick: () => void;
  size?: "sm" | "md" | "lg";
  color?: FavoriteColor;
}

export function StarButton({ active, onClick, size = "md", color }: Props) {
  const dim = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-6 h-6" : "w-8 h-8";
  const activeClass = color
    ? color.star
    : "bg-amber-500 text-neutral-950 hover:bg-amber-400";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={active ? "Remove favorite" : "Add favorite"}
      aria-pressed={active}
      className={`${dim} grid place-items-center rounded-full transition ${
        active
          ? activeClass
          : "bg-neutral-800 text-neutral-400 hover:text-amber-300 hover:bg-neutral-700"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        className={size === "lg" ? "w-5 h-5" : size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"}
      >
        <path
          d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.4l-5.84 3.07 1.11-6.5L2.55 9.37l6.53-.95L12 2.5z"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
