import { Camera, FileText, PenLine } from "lucide-react";

export function SourceIcon({ type, className }: { type: string; className?: string }) {
  if (type === "photo") return <Camera className={className} />;
  if (type === "file") return <FileText className={className} />;
  return <PenLine className={className} />;
}

export function sourceLabel(type: string) {
  return type === "photo" ? "Foto" : type === "file" ? "File" : "Testo";
}
