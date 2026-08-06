export type PublicCategory = {
  _id: string;
  name: string;
  slug: string;
  parentCategory: string | null;
  sortOrder: number;
  image?: { url: string; alt?: string };
  metaTitle: string;
  metaDescription: string;
};
