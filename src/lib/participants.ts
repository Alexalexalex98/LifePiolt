import { useNet } from '@/store/network';

/** Registra chi ha pagato quanto per un seminario, un servizio o un'idea (lo vede chi li ha creati). `sum`: i versamenti della stessa persona si sommano (idee). */
export function addParticipant(key: string, name: string, paid: number, sum = false): void {
  useNet.setState((st) => {
    const cur = st.participants?.[key] ?? [];
    const prev = cur.find((x) => x.name === name);
    const next = { name, paid: (sum && prev ? prev.paid : 0) + paid, paidAt: Date.now() };
    return { participants: { ...(st.participants ?? {}), [key]: [...cur.filter((x) => x.name !== name), next] } };
  });
}
