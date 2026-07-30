import { isValidObjectId, Types } from "mongoose";
import { AppError } from "./AppError";

// Neither health nor uploads has an :id route, and errorHandler.ts has no
// CastError handling — an invalid ObjectId string would otherwise fall
// through to a generic 500. Every :id-based handler validates the shape here
// first so it becomes the standard 400 error contract instead. Also accounts
// for req.params.id's real type, string | string[] | undefined
// (ParamsDictionary's index signature under noUncheckedIndexedAccess: true).
export function parseObjectId(id: string | string[] | undefined): Types.ObjectId {
  if (typeof id !== "string" || !isValidObjectId(id)) {
    throw new AppError(400, "INVALID_ID", `"${String(id)}" is not a valid id.`);
  }
  return new Types.ObjectId(id);
}
