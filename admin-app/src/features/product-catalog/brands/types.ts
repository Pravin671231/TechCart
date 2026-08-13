export interface BrandLogo {
  url: string;
  alt?: string;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  logo?: BrandLogo;
  description?: string;
  status: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BrandListItem = Brand & { productCount: number };

export interface BrandLogoInput {
  objectKey: string;
  alt?: string;
}

export interface CreateBrandInput {
  name: string;
  description?: string;
  logo?: BrandLogoInput;
}

export type UpdateBrandInput = Partial<CreateBrandInput>;
