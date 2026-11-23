"use client";

import { useState } from "react";

/** 버튼을 누르면 열리고, 안의 폼이 제출되면 닫히는 모달 */
export function Modal({
  trigger,
  title,
  triggerClassName = "btn-primary",
  children,
}: {
  trigger: React.ReactNode;
  title: string;
  triggerClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => setOpen(true)}>
        {trigger}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-label={title}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onSubmitCapture={() => setTimeout(() => setOpen(false), 0)}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">{title}</h2>
              <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => setOpen(false)} aria-label="닫기">
                ✕
              </button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
