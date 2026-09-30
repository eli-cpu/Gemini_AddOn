import { useCallback, useState } from "react";
import { ConfirmDialog } from "./ui";

/**
 * const [confirm, confirmDialog] = useConfirm();
 * if (await confirm({ title, message, confirmLabel, danger })) { ... }
 * Render {confirmDialog} somewhere in the component.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setRequest({ ...options, resolve })),
    [],
  );

  const close = (result) => {
    request?.resolve(result);
    setRequest(null);
  };

  const dialog = request ? (
    <ConfirmDialog
      title={request.title}
      message={request.message}
      confirmLabel={request.confirmLabel}
      danger={request.danger}
      onClose={close}
    />
  ) : null;

  return [confirm, dialog];
}
