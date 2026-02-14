"use client";

interface DayFilterProps {
  dates: { date: string; dayLabel: string; isToday: boolean }[];
  activeDate: string;
  onChange: (date: string) => void;
}

export function DayFilter({ dates, activeDate, onChange }: DayFilterProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {dates.map(({ date, dayLabel, isToday }) => {
        const isActive = date === activeDate;
        const dayNum = new Date(date).getDate();
        return (
          <button
            key={date}
            onClick={() => onChange(date)}
            className={`flex flex-col items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              isActive
                ? "bg-indigo-600 text-white"
                : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
            }`}
          >
            <span className="text-[10px] uppercase">{dayLabel}</span>
            <span className="text-sm font-semibold">{dayNum}</span>
            {isToday && <span className="text-[8px] mt-0.5 opacity-70">Auj.</span>}
          </button>
        );
      })}
    </div>
  );
}
