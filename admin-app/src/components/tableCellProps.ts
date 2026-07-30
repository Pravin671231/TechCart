/**
 * Use as `muiTableHeadCellProps` on right-aligned numeric columns. MRT
 * reverses both the header cell's content row AND its label+sort-icon row
 * when `align: "right"`, which puts the sort icon before the label instead
 * of after it. This keeps the icon after the label while still right-
 * anchoring the whole group, by overriding just the inner label row back to
 * a normal (non-reversed) flex direction.
 */
export const rightAlignedHeadCellProps = {
  align: "right" as const,
  sx: {
    "& .Mui-TableHeadCell-Content-Labels": {
      flexDirection: "row",
    },
  },
};
