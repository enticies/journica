import { KeyboardEvent } from "react";
import { Input } from "../../../../shared/ui/Input";
import { Modal } from "../../../../shared/ui/Modal";

interface Props {
  isOpen: boolean;
  value: string;
  isSaving: boolean;
  canSave: boolean;
  errorMessage: string | null;
  title?: string;
  ariaLabel?: string;
  placeholder?: string;
  onValueChange: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onClose: () => void;
  onSave: () => void;
}

export function NewFolderModal({
  isOpen,
  value,
  isSaving,
  canSave,
  errorMessage,
  title = "New Folder",
  ariaLabel = "New folder",
  placeholder = "Folder name",
  onValueChange,
  onInputKeyDown,
  onClose,
  onSave,
}: Props) {
  const footer = (
    <>
      <button
        type="button"
        className="cursor-pointer rounded-lg border border-light-base px-3 py-1.5 text-[13px] font-medium text-dark-90 hover:bg-light-50"
        onClick={onClose}
      >
        Close
      </button>
      <button
        type="button"
        className="cursor-pointer rounded-lg bg-dark-90 px-3 py-1.5 text-[13px] font-medium text-light-10 hover:bg-dark-80 disabled:cursor-not-allowed disabled:bg-dark-20 disabled:text-light-40"
        onClick={onSave}
        disabled={!canSave}
      >
        {isSaving ? "Saving..." : "Save"}
      </button>
    </>
  );

  return (
    <Modal isOpen={isOpen} title={title} onClose={onClose} footer={footer} ariaLabel={ariaLabel}>
      <Input
        value={value}
        onChange={onValueChange}
        onKeyDown={onInputKeyDown}
        placeholder={placeholder}
        autoFocus
        className="h-auto w-full gap-0 rounded-lg px-3 py-2"
        inputClassName="text-dark-90"
      />
      {errorMessage && <p className="mt-2 text-[12px] leading-4 text-red-600">{errorMessage}</p>}
    </Modal>
  );
}
