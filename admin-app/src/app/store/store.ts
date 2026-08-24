import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { api } from "@/app/api/baseApi";

// Issue #148/M3.10 — the `auth` slice (adminKey/sessionStorage) is gone
// entirely; auth state now lives purely in RTK Query's own cache
// (`getSession`, tag "Session") since there's nothing else to track
// client-side beyond the bearer token itself (tokenStorage.ts, outside
// Redux).
const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export const createStore = (preloadedState?: Partial<RootState>) => {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
    preloadedState,
  });
};

export const store = createStore();

export type AppDispatch = typeof store.dispatch;
