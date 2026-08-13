import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithAdminKeyGuard } from "./baseQuery";

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithAdminKeyGuard,
  tagTypes: ["Brand", "Category", "CategorySpecification", "CategoryVariant", "Product"],
  endpoints: () => ({}),
});
