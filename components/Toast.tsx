"use client";

import { createContext, useCallback, useContext, useState } from "react";

type ToastVariant = "error" | "success" | "info";
interface ToastItem {
	id: string;
	message: string;
	variant: ToastVariant;
}

const ToastContext = createContext<{
	showToast: (message: string, variant?: ToastVariant) => void;
} | null>(null);

export function useToast() {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used within ToastProvider");
	return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	const showToast = useCallback(
		(message: string, variant: ToastVariant = "info") => {
			const id = crypto.randomUUID();
			setToasts((prev) => [...prev, { id, message, variant }]);
			setTimeout(
				() => setToasts((prev) => prev.filter((t) => t.id !== id)),
				5000,
			);
		},
		[],
	);

	const dismiss = (id: string) =>
		setToasts((prev) => prev.filter((t) => t.id !== id));

	const borderColor: Record<ToastVariant, string> = {
		error: "border-l-[var(--danger)]",
		success: "border-l-[var(--success)]",
		info: "border-l-[var(--accent)]",
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 w-[calc(100%-2rem)] max-w-sm">
				{toasts.map((t) => (
					<div
						key={t.id}
						role="status"
						className={`animate-in fade-in slide-in-from-right-4 duration-300 bg-[var(--surface)] border-l-4 ${borderColor[t.variant]} text-[var(--text)] text-sm rounded-xl shadow-lg border border-[var(--border)] px-4 py-3 flex items-start justify-between gap-3`}
					>
						<span className="leading-snug">{t.message}</span>
						<button
							onClick={() => dismiss(t.id)}
							className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0 mt-0.5"
							aria-label="Dismiss"
						>
							✕
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}
