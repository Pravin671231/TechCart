import { Card, CardHeading } from "@/components/ui/Card";

export interface SummaryCardProps {
  label: string;
  value: string;
}

export const SummaryCard = ({ label, value }: SummaryCardProps) => {
  return (
    <Card>
      <CardHeading>{label}</CardHeading>
      <p className="text-2xl font-semibold text-neutral-900">{value}</p>
    </Card>
  );
};
