"use client";

import { useState } from "react";

interface PasswordInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	autoComplete?: string;
}

export default function PasswordInput({
	value,
	onChange,
	placeholder = "Password",
	disabled,
	autoComplete,
}: PasswordInputProps) {
	const [show, setShow] = useState(false);

	return (
		<div className="relative">
			<input
				type={show ? "text" : "password"}
				required
				minLength={6}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				disabled={disabled}
				autoComplete={autoComplete}
				placeholder={placeholder}
				className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3.5 py-2.5 pr-11 text-sm text-[var(--text)] outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition disabled:opacity-60"
			/>
			<button
				type="button"
				tabIndex={-1}
				onClick={() => setShow((v) => !v)}
				aria-label={show ? "Hide password" : "Show password"}
				className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
			>
				{show ? (
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a21.8 21.8 0 015.06-6.06M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a21.7 21.7 0 01-3.22 4.5M14.12 14.12a3 3 0 11-4.24-4.24" />
						<line x1="1" y1="1" x2="23" y2="23" />
					</svg>
				) : (
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
						<circle cx="12" cy="12" r="3" />
					</svg>
				)}
			</button>
		</div>
	);
}
