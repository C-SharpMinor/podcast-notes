"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function Auth({ onLogin }: { onLogin: () => void }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");

	const supabase = createClient();

	const handleSignUp = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage("");
		const { error } = await supabase.auth.signUp({ email, password });
		if (error) setMessage(`❌ ${error.message}`);
		else setMessage("✅ Account created! You can now log in.");
		setLoading(false);
	};

	const handleLogin = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setMessage("");
		const { error } = await supabase.auth.signInWithPassword({
			email,
			password,
		});
		if (error) {
			setMessage(`❌ ${error.message}`);
		} else {
			onLogin(); // Tell the parent component we are logged in
		}
		setLoading(false);
	};

	return (
		<div className="max-w-md mx-auto mt-20 p-8 bg-slate-900 rounded-xl shadow-lg border border-slate-800">
			<h2 className="text-2xl font-bold text-white mb-6 text-center">
				Welcome to AI Notes
			</h2>

			{message && (
				<div
					className={`p-3 rounded mb-4 text-sm ${message.includes("❌") ? "bg-red-900/50 text-red-200" : "bg-green-900/50 text-green-200"}`}
				>
					{message}
				</div>
			)}

			<form className="space-y-4">
				<div>
					<label className="block text-gray-400 text-sm mb-1">Email</label>
					<input
						type="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
						placeholder="you@example.com"
					/>
				</div>
				<div>
					<label className="block text-gray-400 text-sm mb-1">Password</label>
					<input
						type="password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full bg-slate-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
						placeholder="••••••••"
					/>
				</div>

				<div className="flex gap-4 pt-4">
					<button
						onClick={handleLogin}
						disabled={loading}
						className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-semibold transition"
					>
						{loading ? "..." : "Log In"}
					</button>
					<button
						onClick={handleSignUp}
						disabled={loading}
						className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg font-semibold transition"
					>
						Sign Up
					</button>
				</div>
			</form>
		</div>
	);
}
