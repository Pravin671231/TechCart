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
        <th className="px-3 py-2">Product</th>
        <th className="px-3 py-2">Units sold</th>
        <th className="px-3 py-2">Revenue</th>
      </TableHeadRow>
      <tbody>
        {products.length === 0 ? (
          <EmptyRow colSpan={3} message="No sales in this range yet." />
        ) : (
          products.map((product) => (
            <tr key={product.productId} className="border-b border-neutral-100">
              <td className="px-3 py-2">{product.name}</td>
              <td className="px-3 py-2">{product.unitsSold}</td>
              <td className="px-3 py-2">{formatPrice(product.revenue)}</td>
            </tr>
          ))
        )}
      </tbody>
    </Table>
  );
};
