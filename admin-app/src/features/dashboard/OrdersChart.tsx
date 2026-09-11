import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTheme } from "@/hooks/useTheme";
import { getChartColors } from "./chartColors";
import type { SalesOverTimePoint } from "./types";

export interface OrdersChartProps {
  series: SalesOverTimePoint[];
}

// Plots the `orders` count the revenue chart ignores — same date buckets,
// same `sales` series.
export const OrdersChart = ({ series }: OrdersChartProps) => {
  const { theme } = useTheme();
  const colors = getChartColors(theme);
  const axisTick = { fontSize: 11, fill: colors.axisTick } as const;
  const tooltipStyle = {
    borderRadius: 8,
    border: `1px solid ${colors.tooltipBorder}`,
    background: colors.tooltipBackground,
    fontSize: 12,
  } as const;

  return (
    <div className="h-55 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: colors.cursorFill }} />
          <Bar dataKey="orders" fill={colors.line} radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
