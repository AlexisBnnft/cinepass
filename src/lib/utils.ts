export function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function getWeekDates(startDate?: string): { date: string; dayLabel: string; isToday: boolean }[] {
  const start = startDate ? new Date(startDate) : new Date();
  const today = todayString();
  const days: { date: string; dayLabel: string; isToday: boolean }[] = [];
  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({
      date: dateStr,
      dayLabel: dayNames[d.getDay()],
      isToday: dateStr === today,
    });
  }
  return days;
}

export function formatDuration(minutes: number | null): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

export function formatArrondissement(arr: number): string {
  if (arr === 1) return "1er";
  return `${arr}e`;
}
