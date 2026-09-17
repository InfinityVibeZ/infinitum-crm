"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";
import { toast } from "react-hot-toast";

type Severity = "success" | "error" | "warning" | "info";

interface AlertContextType {
  showAlert: (message: string, severity?: Severity) => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export const AlertProvider = ({ children }: { children: ReactNode }) => {
  const showAlert = useCallback((message: string, severity: Severity = "success") => {
    if (severity === "error") {
      toast.error(message);
    } else if (severity === "success") {
      toast.success(message);
    } else {
      toast(message);
    }
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) {
    throw new Error("useAlert must be used inside AlertProvider");
  }
  return ctx;
};
