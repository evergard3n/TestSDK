// Simple toast utility for error handling
export function showError(error: any): void {
  const message =
    typeof error === "string"
      ? error
      : error?.message || "An unknown error occurred";

  console.error("Error:", message);

  // You can replace this with a proper toast library like react-hot-toast
  // For now, we'll use a simple alert
  if (typeof window !== "undefined") {
    alert(`Error: ${message}`);
  }
}

export function showSuccess(message: string): void {
  console.log("Success:", message);

  // You can replace this with a proper toast library
  if (typeof window !== "undefined") {
    alert(`Success: ${message}`);
  }
}

export function showWarning(message: string): void {
  console.warn("Warning:", message);

  // You can replace this with a proper toast library
  if (typeof window !== "undefined") {
    alert(`Warning: ${message}`);
  }
}
