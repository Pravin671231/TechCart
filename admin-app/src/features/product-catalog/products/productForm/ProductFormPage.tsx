import { useParams } from "react-router";
import { useGetProductQuery } from "../productsApi";
import { ProductForm } from "./ProductForm";

export const ProductFormPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: product, isLoading, isError } = useGetProductQuery(id ?? "", { skip: !id });

  if (id && isLoading) return <main className="p-6 text-sm text-neutral-500">Loading…</main>;
  if (id && isError) {
    return <main className="p-6 text-sm text-red-600">Unable to load this product.</main>;
  }

  return <ProductForm product={id ? (product ?? null) : null} />;
};
