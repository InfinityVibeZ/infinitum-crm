"use client";

import { Toaster, ToastBar, toast } from "react-hot-toast";
import { IconX } from "@tabler/icons-react";

export function GlobalToaster() {
  return (
    <Toaster position="bottom-right" toastOptions={{ duration: 4000, error: { duration: 10000 } }}>
      {(t) => {
        const isError = t.type === 'error';
        const isSuccess = t.type === 'success';
        const bgColor = isError ? 'bg-red-600' : isSuccess ? 'bg-emerald-600' : 'bg-[#0c0f14] border border-white/10';
        return (
          <ToastBar toast={t} style={{ padding: 0, background: 'transparent', boxShadow: 'none' }}>
            {({ icon, message }) => (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl min-w-[300px] max-w-md ${bgColor} text-white animate-in slide-in-from-bottom-2`}>
                {icon}
                <span className="flex-1 text-sm font-semibold">{message}</span>
                <button onClick={() => toast.dismiss(t.id)} className="p-1 rounded-md hover:bg-black/10 transition-colors shrink-0">
                  <IconX size={16} className="text-white/80 hover:text-white" />
                </button>
              </div>
            )}
          </ToastBar>
        );
      }}
    </Toaster>
  );
}
