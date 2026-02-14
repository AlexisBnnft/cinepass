"use client";

import { useState } from "react";

const TIME_PRESETS = [
  { label: "Toute la journée", min: "", max: "" },
  { label: "Matinée", min: "06:00", max: "12:00" },
  { label: "Après-midi", min: "12:00", max: "18:00" },
  { label: "Soirée", min: "18:00", max: "23:00" },
  { label: "19h-23h", min: "19:00", max: "23:00" },
];

const HOURS = Array.from({ length: 18 }, (_, i) => {
  const h = i + 6;
  return { value: `${h.toString().padStart(2, "0")}:00`, label: `${h}h` };
});

interface TimeRangeFilterProps {
  timeMin: string;
  timeMax: string;
  onChange: (min: string, max: string) => void;
}

export function TimeRangeFilter({ timeMin, timeMax, onChange }: TimeRangeFilterProps) {
  const [customMode, setCustomMode] = useState(false);

  const activePreset = TIME_PRESETS.find(
    (p) => p.min === timeMin && p.max === timeMax
  );
  const isCustom = customMode || (!activePreset && (!!timeMin || !!timeMax));

  return (
    <div className="flex-1 min-w-0">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TIME_PRESETS.map((preset) => {
          const isActive = !isCustom && (activePreset === preset || (!activePreset && !preset.min && !timeMin));
          return (
            <button
              key={preset.label}
              onClick={() => {
                setCustomMode(false);
                onChange(preset.min, preset.max);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          onClick={() => {
            setCustomMode(true);
            if (!timeMin && !timeMax) {
              onChange("18:00", "23:00");
            }
          }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
            isCustom
              ? "bg-indigo-600 text-white"
              : "bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          }`}
        >
          Personnaliser
        </button>
      </div>
      {isCustom && (
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-500">De</label>
          <select
            value={timeMin || "06:00"}
            onChange={(e) => onChange(e.target.value, timeMax || "23:00")}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {HOURS.map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
          <label className="text-xs text-gray-500">à</label>
          <select
            value={timeMax || "23:00"}
            onChange={(e) => onChange(timeMin || "06:00", e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {HOURS.filter((h) => h.value >= (timeMin || "06:00")).map((h) => (
              <option key={h.value} value={h.value}>{h.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
