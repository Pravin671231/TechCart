import { createTheme } from "@mui/material/styles";

/**
 * Scoped to DataTable.tsx only — not applied app-wide. Matches Material React
 * Table's look to admin-app's Tailwind design tokens (primary green, rounded-lg
 * radius) so the table doesn't visually clash with the rest of the shell.
 * See design.md.
 */
export const muiTheme = createTheme({
  palette: {
    primary: {
      main: "#16A34A",
    },
  },
  shape: {
    borderRadius: 8,
  },
});
