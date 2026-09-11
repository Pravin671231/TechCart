import type { Theme } from "@/theme/ThemeContext";

export interface ChartColors {
  axisTick: string;
  grid: string;
  tooltipBorder: string;
  tooltipBackground: string;
  line: string;
  cursorFill: string;
}

const LIGHT: ChartColors = {
  axisTick: "#8c91a1",
  grid: "#f0f1f5",
  tooltipBorder: "#ececf4",
  tooltipBackground: "#ffffff",
  line: "#4f46e5",
  cursorFill: "#f5f5f7",
};

const DARK: ChartColors = {
  axisTick: "#a1a1aa",
  grid: "#3f3f46",
  tooltipBorder: "#52525b",
  tooltipBackground: "#18181b",
  line: "#818cf8",
  cursorFill: "#27272a",
};

export function getChartColors(theme: Theme): ChartColors {
  return theme === "dark" ? DARK : LIGHT;
}
