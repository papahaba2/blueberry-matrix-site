"use client";

import { Toaster } from "sonner";

export default function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      theme="dark"
      toastOptions={{
        style: {
          background: "#0d0a12",
          border: "1px solid rgba(255,255,255,0.1)",
          color: "#f5f2ff",
        },
      }}
    />
  );
}
