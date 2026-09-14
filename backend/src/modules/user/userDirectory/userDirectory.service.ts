import { buildPagination, type Pagination } from "@/utils/apiResponse";
import * as userDirectoryRepository from "./userDirectory.repository";
import type {
  UserDirectoryListPage,
  UserDirectoryListSort,
  UserDirectoryRecord,
} from "./userDirectory.repository";

export async function listUserDirectory(
  filter: Record<string, unknown>,
  sort: UserDirectoryListSort | undefined,
  page: UserDirectoryListPage,
): Promise<{ items: UserDirectoryRecord[]; pagination: Pagination }> {
  const { items, total } = await userDirectoryRepository.list(filter, sort, page);
  return { items, pagination: buildPagination(page.page, page.limit, total) };
}
