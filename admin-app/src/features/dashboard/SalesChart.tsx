import {
  CartesianGrid,
  Line,
  LineChart,
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

export const SalesChart = ({ series }: SalesChartProps) => {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={(value: number) => formatPrice(value)} />
          <Tooltip formatter={(value) => formatPrice(Number(value))} />
          <Line type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
