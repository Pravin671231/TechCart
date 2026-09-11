import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/features/product-catalog/products/money";
import { useTheme } from "@/hooks/useTheme";
import { getChartColors } from "./chartColors";
import type { SalesOverTimePoint } from "./types";

export interface SalesChartProps {
  series: SalesOverTimePoint[];
}

export const SalesChart = ({ series }: SalesChartProps) => {
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
        <AreaChart data={series} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.line} stopOpacity={0.25} />
              <stop offset="100%" stopColor={colors.line} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={colors.grid} vertical={false} />
          <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatPrice(value)}
            width={72}
          />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatPrice(Number(value))} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={colors.line}
            strokeWidth={2}
            fill="url(#revenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
