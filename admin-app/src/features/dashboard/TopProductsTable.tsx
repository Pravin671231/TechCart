import { Table, TableHeadRow, EmptyRow } from "@/components/ui/Table";
import { formatPrice } from "@/features/product-catalog/products/money";
import type { TopProduct } from "./types";

export interface TopProductsTableProps {
  products: TopProduct[];
  isFetching?: boolean;
}

export const TopProductsTable = ({ products, isFetching = false }: TopProductsTableProps) => {
  return (
    <Table isFetching={isFetching}>
      <TableHeadRow variant="shaded">
        <th className="px-3 py-2">#</th>
        <th className="px-3 py-2">Product</th>
        <th className="px-3 py-2 text-right">Units sold</th>
        <th className="px-3 py-2 text-right">Revenue</th>
      </TableHeadRow>
      <tbody>
        {products.length === 0 ? (
          <EmptyRow colSpan={4} message="No sales in this range yet." />
        ) : (
          products.map((product, index) => (
            <tr key={product.productId} className="border-b border-neutral-100 hover:bg-neutral-50">
              <td className="px-3 py-2 text-neutral-400 tabular-nums">{index + 1}</td>
              <td className="px-3 py-2 font-medium text-neutral-900">{product.name}</td>
              <td className="px-3 py-2 text-right tabular-nums">{product.unitsSold}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">
                {formatPrice(product.revenue)}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
};
