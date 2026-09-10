"use client";
import { allCountries } from "@/lib/countries";
import { Select } from "./ui/field";

export function CountrySelect({
  name = "country_code",
  defaultValue,
  value,
  onChange,
  id,
  required = true,
  disabled,
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (code: string) => void;
  id?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      defaultValue={onChange ? undefined : defaultValue}
      value={onChange ? value : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
    >
      <option value="">Select a country</option>
      {allCountries().map((c) => (
        <option key={c.code} value={c.code}>
          {c.flag} {c.name}
        </option>
      ))}
    </Select>
  );
}
