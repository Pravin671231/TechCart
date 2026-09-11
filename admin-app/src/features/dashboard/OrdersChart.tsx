import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SalesOverTimePoint } from "./types";

export interface OrdersChartProps {
  series: SalesOverTimePoint[];
}

const AXIS_TICK = { fontSize: 11, fill: "#8c91a1" } as const;
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #ececf4",
  fontSize: 12,
} as const;

// Plots the `orders` count the revenue chart ignores — same date buckets,
// same `sales` series.
export const OrdersChart = ({ series }: OrdersChartProps) => {
  return (
    <div className="h-55 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
          <CartesianGrid stroke="#f0f1f5" vertical={false} />
          <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={40}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "#f5f5f7" }} />
          <Bar dataKey="orders" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
