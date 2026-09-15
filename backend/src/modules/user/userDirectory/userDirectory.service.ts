import type { Types } from "mongoose";
import { buildPagination, type Pagination } from "@/utils/apiResponse";
import { AppError } from "@/utils/AppError";
import * as userDirectoryRepository from "./userDirectory.repository";
import type {
  UserDirectoryListPage,
  UserDirectoryListSort,
  UserDirectoryRecord,
} from "./userDirectory.repository";

export async function getUserDirectoryEntry(id: Types.ObjectId): Promise<UserDirectoryRecord> {
  const record = await userDirectoryRepository.findById(id);
  if (!record) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  }
  return record;
}

export async function listUserDirectory(
  filter: Record<string, unknown>,
  sort: UserDirectoryListSort | undefined,
  page: UserDirectoryListPage,
): Promise<{ items: UserDirectoryRecord[]; pagination: Pagination }> {
  const { items, total } = await userDirectoryRepository.list(filter, sort, page);
  return { items, pagination: buildPagination(page.page, page.limit, total) };
}
