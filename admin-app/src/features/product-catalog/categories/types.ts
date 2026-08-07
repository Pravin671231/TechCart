export interface CategoryImage {
  url: string;
  alt?: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  parentCategory?: string | null;
  image?: CategoryImage;
  description?: string;
  sortOrder: number;
  status: boolean;
  metaTitle?: string;
  metaDescription?: string;
  createdAt: string;
  updatedAt: string;
}

export type CategoryListItem = Category & { productCount: number };

export interface CategoryImageInput {
  objectKey: string;
  alt?: string;
}

export interface CreateCategoryInput {
  name: string;
  description?: string;
  parentCategory?: string;
  image?: CategoryImageInput;
  sortOrder?: number;
  metaTitle?: string;
  metaDescription?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  parentCategory?: string | null;
  image?: CategoryImageInput;
  sortOrder?: number;
  metaTitle?: string;
  metaDescription?: string;
}
