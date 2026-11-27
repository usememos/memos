import { useState } from "react";

/**
 * Client-side validation errors keyed by field. A form shows each one under its field with
 * `Field.Root invalid` and `Field.Error`, instead of a toast, and clears it when the field changes.
 */
export const useFieldErrors = <Field extends string>() => {
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const set = (field: Field, message: string) => setErrors({ [field]: message } as Partial<Record<Field, string>>);
  const clear = (field: Field) =>
    setErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });

  return { errors, set, clear };
};
