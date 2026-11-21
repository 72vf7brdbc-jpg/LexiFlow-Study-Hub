import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, ArrowUpRight } from "lucide-react";
import { booksQuery } from "@/lib/book-queries";
import { formatBytes } from "@/lib/file-prep";

export function BooksShelf() {
  const { data: books } = useSuspenseQuery(booksQuery);
  if (!books.length) return null;
  return <section className="space-y-4">
    <h2 className="font-display text-2xl">I tuoi libri</h2>
    <div className="ledger-rule" />
    <ul className="grid gap-3 md:grid-cols-2">{books.map(book => <li key={book.id}><Link to="/books/$bookId" params={{ bookId: book.id }} className="flex h-full items-start gap-4 rounded-lg border border-primary/25 bg-primary/5 p-5 transition-colors hover:bg-primary/10"><BookOpen className="mt-1 size-6 shrink-0 text-primary" /><div className="min-w-0 flex-1"><h3 className="break-words font-display text-xl">{book.title}</h3><p className="mt-1 text-sm text-muted-foreground">{book.page_count} pagine · {formatBytes(book.file_size)}</p><p className="mt-2 text-xs font-semibold text-primary">{book.mode === "automatic" ? "Lezioni progressive" : "Pagine selezionate"}</p></div><ArrowUpRight className="size-4 shrink-0" /></Link></li>)}</ul>
  </section>;
}