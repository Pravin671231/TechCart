import type { IconType } from "react-icons";
import { LuCircleCheck, LuFilePen, LuPackage, LuTriangleAlert } from "react-icons/lu";

const stats: {
  label: string;
  value: number;
  icon: IconType;
  iconClassName: string;
}[] = [
  {
    label: "Total Products",
    value: 128,
    icon: LuPackage,
    iconClassName: "bg-primary-100 text-primary-700",
  },
  {
    label: "Published",
    value: 96,
    icon: LuCircleCheck,
    iconClassName: "bg-success-100 text-success-700",
  },
  {
    label: "Draft",
    value: 24,
    icon: LuFilePen,
    iconClassName: "bg-warning-100 text-warning-700",
  },
  {
    label: "Low Stock",
    value: 8,
    icon: LuTriangleAlert,
    iconClassName: "bg-danger-100 text-danger-700",
  },
];

export function Dashboard() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-800">Dashboard</h1>
        <p className="text-sm text-neutral-500">Catalog overview</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, iconClassName }) => (
          <div
            key={label}
            className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-4"
          >
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-full ${iconClassName}`}
            >
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-semibold text-neutral-800">{value}</p>
              <p className="text-sm text-neutral-500">{label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
