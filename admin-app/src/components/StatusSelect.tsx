import { MenuItem, Select } from "@mui/material";

type StatusSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
};

export function StatusSelect({ value, onChange, options }: StatusSelectProps) {
  return (
    <Select
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      sx={{ minWidth: 120 }}
      onClick={(event) => event.stopPropagation()}
    >
      {options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </Select>
  );
}
