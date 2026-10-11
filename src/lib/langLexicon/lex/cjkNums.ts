/** Numeri scritti in caratteri cinesi/giapponesi (1..59) -> valore. Serve a cinese e giapponese. */
export function cjkNums(): Record<string, number> {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const out: Record<string, number> = { 两: 2, 兩: 2, 〇: 0 };
  for (let n = 0; n < 60; n++) {
    const t = Math.floor(n / 10), u = n % 10;
    const s = n < 10 ? d[n] : n < 20 ? '十' + (u ? d[u] : '') : d[t] + '十' + (u ? d[u] : '');
    out[s] = n;
  }
  return out;
}
