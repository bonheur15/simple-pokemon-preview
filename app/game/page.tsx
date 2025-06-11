"use client";

import dynamic from "next/dynamic";
import React from "react";

const PokemonFlipGame = dynamic(() => import("./game"), {
  loading: () => <p>Loading...</p>, // Optional: fallback while loading
  ssr: false, // Optional: skip server-side rendering
});

export default function GomePage({
  searchParams,
}: {
  searchParams: { page: number; size: number };
}) {
  return <PokemonFlipGame />;
}
