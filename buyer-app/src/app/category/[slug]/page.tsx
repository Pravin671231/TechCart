import { CategoryContent } from "@/features/category/CategoryContent";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CategoryContent slug={slug} />;
}
