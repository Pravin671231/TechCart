import { combineReducers, configureStore } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import { api } from "./api";

const rootReducer = combineReducers({
  auth: authReducer,
  [api.reducerPath]: api.reducer,
});

export type RootState = ReturnType<typeof rootReducer>;

export function createStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(api.middleware),
    preloadedState,
  });
}

export const store = createStore();

export type AppDispatch = typeof store.dispatch;
