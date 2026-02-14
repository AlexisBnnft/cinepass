"use client";

export function Header() {
  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-sm font-bold">
            C
          </div>
          <h1 className="text-xl font-semibold tracking-tight">CinePass</h1>
          <span className="text-xs text-gray-500 hidden sm:inline">Paris</span>
        </div>
      </div>
    </header>
  );
}
