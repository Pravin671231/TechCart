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
import type { SalesOverTimePoint } from "./types";

export interface SalesChartProps {
  series: SalesOverTimePoint[];
}

const AXIS_TICK = { fontSize: 11, fill: "#8c91a1" } as const;
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #ececf4",
  fontSize: 12,
} as const;

export const SalesChart = ({ series }: SalesChartProps) => {
  return (
    <div className="h-55 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f0f1f5" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickFormatter={(value: number) => formatPrice(value)}
            width={72}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => formatPrice(Number(value))} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#4f46e5"
            strokeWidth={2}
            fill="url(#revenueFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
