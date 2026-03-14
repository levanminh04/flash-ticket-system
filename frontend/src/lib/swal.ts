import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

type ConfirmDialogOptions = {
  title: string;
  text: string;
  confirmButtonText: string;
  cancelButtonText?: string;
};

const confirmDialog = Swal.mixin({
  showCancelButton: true,
  reverseButtons: true,
  focusCancel: true,
  heightAuto: false,
  confirmButtonColor: "#dc2626",
  cancelButtonColor: "#94a3b8",
});

export async function confirmDestructiveAction({
  title,
  text,
  confirmButtonText,
  cancelButtonText = "Quay lại",
}: ConfirmDialogOptions): Promise<boolean> {
  const result = await confirmDialog.fire({
    icon: "warning",
    title,
    text,
    confirmButtonText,
    cancelButtonText,
  });

  return result.isConfirmed;
}