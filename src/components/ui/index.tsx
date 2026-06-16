"use client";

import { useEffect } from "react";

type BtnVariant = "primary" | "ghost" | "danger";

export function Button({
  variant = "primary", className = "", ...props
}: { variant?: BtnVariant } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "rounded-[10px] font-bold text-sm px-4 py-2.5 cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed";
  const styles: Record<BtnVariant, string> = {
    primary: "bg-navy text-cream hover:bg-navysoft border-0",
    ghost: "bg-white text-navy border border-line hover:border-navy",
    danger: "bg-danger text-white border-0 hover:opacity-90",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block mt-2.5">
      <div className="text-xs text-gray-500 font-semibold mb-1.5">{label}</div>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full px-3 py-2.5 border border-line rounded-[9px] text-sm bg-white text-navy outline-none focus:border-navy";

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-navy/35 z-50" />
      <div className="fixed z-[60] bg-cream rounded-2xl p-5 w-[360px] max-w-[92vw] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl">
        <div className="flex justify-between items-center mb-3">
          <strong>{title}</strong>
          <button onClick={onClose} className="text-sm border border-line rounded-md px-2 py-1 bg-white">✕</button>
        </div>
        {children}
      </div>
    </>
  );
}

export function Confirm({
  title, message, cancelLabel = "Batal", confirmLabel = "Ya", danger,
  onCancel, onConfirm,
}: {
  title: string; message?: string; cancelLabel?: string; confirmLabel?: string;
  danger?: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <>
      <div onClick={onCancel} className="fixed inset-0 bg-navy/35 z-[60]" />
      <div className="fixed z-[70] bg-cream rounded-2xl p-6 w-[380px] max-w-[92vw] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-2xl">
        <div className="font-serif text-lg mb-2">{title}</div>
        {message ? <div className="text-sm text-gray-500 leading-relaxed mb-5">{message}</div> : <div className="h-3" />}
        <div className="flex gap-2.5">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={danger ? "danger" : "primary"} className="flex-1" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </>
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 bg-navy text-cream px-5 py-2.5 rounded-full text-sm font-semibold z-[80] shadow-lg">
      {message}
    </div>
  );
}
