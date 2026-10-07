export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);
