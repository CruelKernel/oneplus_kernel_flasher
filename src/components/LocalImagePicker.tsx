import { useState, type ChangeEvent } from 'react';

interface LocalImagePickerProps {
  /** Exact size the selected file must have; 0 disables the check */
  expectedSize: number;
  label: string;
  className: string;
  onSelect: (file: File) => void;
}

/**
 * A button-styled file input for picking a manually downloaded init_boot.img.
 * The file is only handed to `onSelect` when its size matches the release asset.
 */
export function LocalImagePicker({
  expectedSize,
  label,
  className,
  onSelect,
}: LocalImagePickerProps) {
  const [error, setError] = useState<string | null>(null);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const file = input.files?.[0];
    // Allow picking the same file again after a rejection
    input.value = '';
    if (!file) return;

    if (expectedSize > 0 && file.size !== expectedSize) {
      setError(
        `Selected file is ${file.size.toLocaleString()} bytes, ` +
          `expected ${expectedSize.toLocaleString()} bytes`,
      );
      return;
    }

    setError(null);
    onSelect(file);
  };

  return (
    <div className="inline-block">
      <label className={`${className} inline-block cursor-pointer`}>
        {label}
        <input
          type="file"
          accept=".img,application/octet-stream"
          className="sr-only"
          onChange={handleChange}
        />
      </label>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
