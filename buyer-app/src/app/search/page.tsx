import { SearchContent } from "@/features/search/SearchContent";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <SearchContent q={q ?? ""} />;
}
