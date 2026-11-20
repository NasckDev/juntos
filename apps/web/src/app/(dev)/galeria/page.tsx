import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Gallery } from "@/components/galeria/gallery";

export const metadata: Metadata = { title: "Galeria", robots: { index: false } };

export default function GaleriaPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
