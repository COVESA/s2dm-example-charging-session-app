"use client";

import { useEffect, ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  titleId?: string;
  maxWidth?: "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, children, titleId, maxWidth = "md" }: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`relative z-10 flex w-full ${maxWidthClasses[maxWidth]} flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl max-h-[92vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

export function ModalHeader({ title, titleId, onClose }: { title: string; titleId?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-6 pt-6 pb-4">
      <h2
        id={titleId}
        className="text-[17px] font-bold text-slate-900"
      >
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
        aria-label="Close"
        style={{ margin: 0, padding: 0, border: "none" }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
      </button>
    </div>
  );
}
