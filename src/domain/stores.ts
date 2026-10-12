/**
 * Registro degli store toccati dalle operazioni di dominio (per snapshot/rollback).
 * Gli store NON importano mai src/domain: la dipendenza va solo in questo verso (nessun ciclo).
 */
import { useChat } from '@/store/chat';
import { useClub } from '@/store/club';
import { useFin } from '@/store/finance';
import { useJobs } from '@/store/jobs';
import { useLife } from '@/store/life';
import { useNet } from '@/store/network';
import { registerStore } from './operation.ts';

let done = false;
export function registerDomainStores() {
  if (done) return;
  done = true;
  registerStore('fin', useFin);
  registerStore('life', useLife);
  registerStore('net', useNet);
  registerStore('jobs', useJobs);
  registerStore('club', useClub);
  registerStore('chat', useChat);
}
registerDomainStores();
