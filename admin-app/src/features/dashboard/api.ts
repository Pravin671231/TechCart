import { api } from "@/app/api/baseApi";
import { unwrapData } from "@/app/api/apiResponse";
import type { ApiSuccessEnvelope } from "@/app/api/api.types";
import { DASHBOARD_ENDPOINTS } from "./endpoints";
import type {
  CatalogSummary,
  DateRangeParams,
  SalesOverTime,
  SalesSummary,
  TopProducts,
} from "./types";

// Issue #174/M7.4 — read-only, no mutation anywhere in this app touches
// dashboard data, so no cache tag is declared (there's nothing to
// invalidate); the backend's own 60s TTL cache is the only staleness
// control that applies here.
export const dashboardApi = api.injectEndpoints({
  endpoints: (build) => ({
    getSalesSummary: build.query<SalesSummary, DateRangeParams | void>({
      query: (params) => ({ url: DASHBOARD_ENDPOINTS.summary, params: params ?? undefined }),
      transformResponse: (response: ApiSuccessEnvelope<SalesSummary>) => unwrapData(response),
    }),
    getSalesOverTime: build.query<SalesOverTime, DateRangeParams | void>({
      query: (params) => ({ url: DASHBOARD_ENDPOINTS.sales, params: params ?? undefined }),
      transformResponse: (response: ApiSuccessEnvelope<SalesOverTime>) => unwrapData(response),
    }),
    getTopProducts: build.query<TopProducts, DateRangeParams | void>({
      query: (params) => ({ url: DASHBOARD_ENDPOINTS.topProducts, params: params ?? undefined }),
      transformResponse: (response: ApiSuccessEnvelope<TopProducts>) => unwrapData(response),
    }),
    getCatalogSummary: build.query<CatalogSummary, void>({
      query: () => ({ url: DASHBOARD_ENDPOINTS.catalogSummary }),
      transformResponse: (response: ApiSuccessEnvelope<CatalogSummary>) => unwrapData(response),
    }),
  }),
});

export const {
  useGetSalesSummaryQuery,
  useGetSalesOverTimeQuery,
  useGetTopProductsQuery,
  useGetCatalogSummaryQuery,
} = dashboardApi;
