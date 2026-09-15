export const USER_DIRECTORY_ROUTES = {
  list: "/user-directory",
  detailPattern: "/user-directory/:id",
  detail: (id: string) => `/user-directory/${id}`,
} as const;
