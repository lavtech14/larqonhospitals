import toast from "react-hot-toast";

export const showSuccess = (msg) => toast.success(msg);
export const showError = (msg) => toast.error(msg);
export const showInfo = (msg) => toast(msg);

// Wraps an async action and toasts based on result
export const withToast = async (promise, { success, error } = {}) => {
  try {
    const result = await promise;
    if (success) showSuccess(success);
    return result;
  } catch (e) {
    showError(e?.response?.data?.message || error || "Something went wrong");
    throw e;
  }
};
