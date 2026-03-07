import { useCallback } from "react";

interface UseInputChangeParams {
  onChange: (value: string) => void;
}

export function useInputChange({ onChange }: UseInputChangeParams) {
  const handleChange = useCallback(
    (value: string) => {
      onChange(value);
    },
    [onChange],
  );

  return {
    handleChange,
  };
}
