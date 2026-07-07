import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';

const MySwal = withReactContent(Swal);

// A pre-configured base instance that respects our light/dark CSS variables
const BaseSwal = MySwal.mixin({
  customClass: {
    popup: 'swal2-custom-popup',
    title: 'swal2-custom-title',
    htmlContainer: 'swal2-custom-content',
    confirmButton: 'btn btn-primary',
    cancelButton: 'btn btn-secondary',
    actions: 'swal2-custom-actions',
  },
  buttonsStyling: false, // Turn off default SweetAlert styling for buttons to use Bootstrap/our own classes
  showClass: {
    popup: 'animate__animated animate__fadeInDown animate__faster'
  },
  hideClass: {
    popup: 'animate__animated animate__fadeOutUp animate__faster'
  }
});

/**
 * Show a simple confirmation dialog for deleting or destructive actions.
 * @param {string} title The title of the confirmation dialog.
 * @param {string} text The subtext/description.
 * @param {string} confirmText The text on the confirm button.
 * @returns {Promise<boolean>} True if confirmed, false otherwise.
 */
export const confirmAction = async (
  title = 'Are you sure?',
  text = 'This action cannot be undone!',
  confirmText = 'Yes, do it!'
) => {
  const result = await BaseSwal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: 'Cancel',
    reverseButtons: true, // Put Cancel on the left, Confirm on the right
  });

  return result.isConfirmed;
};

/**
 * Show a success notification modal.
 */
export const showSuccessModal = (title, text = '') => {
  return BaseSwal.fire({
    title,
    text,
    icon: 'success',
    timer: 2000,
    showConfirmButton: false
  });
};

/**
 * Show an error notification modal.
 */
export const showErrorModal = (title, text = '') => {
  return BaseSwal.fire({
    title,
    text,
    icon: 'error',
    confirmButtonText: 'OK'
  });
};

export default BaseSwal;
