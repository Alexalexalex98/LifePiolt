import test from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../src/lib/profile/identity.ts';

test('richiesta documento: servono tutti i lati', () => {
  assert.deepEqual(I.missingSides('id_card', { front: true }), ['back']);
  assert.deepEqual(I.missingSides('passport', { front: true }), []);
  assert.equal(I.submitRequest('id_card', { front: true }, false, 1), null);
  const r = I.submitRequest('passport', { front: true }, true, 5, true);
  assert.equal(r.status, 'pending');
  assert.equal(r.preview, true);
  assert.equal(r.submittedAt, 5);
});
test('stati: in attesa -> verificato / respinto con motivo', () => {
  const p = I.submitRequest('passport', { front: true }, false, 1);
  assert.equal(I.resolveRequest(p, true, 9).status, 'verified');
  const bad = I.resolveRequest(p, false, 9, 'Documento scaduto');
  assert.equal(bad.status, 'rejected');
  assert.equal(bad.reason, 'Documento scaduto');
  assert.equal(I.resolveRequest(I.resolveRequest(p, true, 9), false, 10).status, 'verified');
  assert.equal(I.resolveRequest(I.EMPTY_IDENTITY, true, 1).status, 'none');
});
test('cosa sblocca: l\'uso base non dipende mai dall\'identità', () => {
  for (const s of ['none', 'pending', 'verified', 'rejected']) assert.ok(I.can(s, 'chat'));
  assert.equal(I.can('none', 'browse'), false);
  assert.equal(I.can('pending', 'browse'), true);
  assert.equal(I.can('none', 'post'), false);
  assert.equal(I.can('pending', 'post'), true);
  for (const a of ['vote', 'sell', 'offer', 'club', 'business', 'receiveLP']) { assert.equal(I.can('pending', a), false, a); assert.equal(I.can('verified', a), true, a); assert.ok(I.lockedReason('none', a)); }
  assert.equal(I.lockedReason('verified', 'vote'), null);
});
test('attività: titolare sempre visibile e non oscurabile', () => {
  assert.equal(I.OWNER_HIDEABLE, false);
  const b = { id: 'b1', owner: 'Anna Rossi', name: 'Panificio Rossi', kind: 'attivita', desc: '', color: '#fff', contacts: { showEmail: false, showPhone: false, showWeb: false }, createdAt: 1 };
  const v = I.businessView(b, true);
  assert.equal(v.ownerLine, 'di Anna Rossi');
  assert.equal(v.ownerHidden, false);
  assert.equal(v.ownerVerified, true);
});
test('attività sul profilo: il titolare può toglierla, gli altri non la vedono', () => {
  const mk = (id, hidden) => ({ id, owner: 'Anna', name: id, kind: 'altro', desc: '', color: '#000', contacts: { showEmail: false, showPhone: false, showWeb: false }, createdAt: 1, hiddenOnProfile: hidden });
  const list = [mk('a', false), mk('b', true), { ...mk('c', false), owner: 'Altro' }];
  assert.deepEqual(I.businessesOnProfile(list, 'Anna', true).map((x) => x.id), ['a', 'b']);
  assert.deepEqual(I.businessesOnProfile(list, 'Anna', false).map((x) => x.id), ['a']);
});
test('validazione e contatti pubblici', () => {
  assert.ok(I.validateBusiness({ name: ' ', kind: 'altro' }));
  assert.equal(I.validateBusiness({ name: 'Bar', kind: 'azienda' }), null);
  assert.ok(I.validateBusiness({ name: 'Bar', kind: 'boh' }));
  const c = I.publicContacts({ email: 'a@b.ch', phone: '', web: 'x.ch', showEmail: true, showPhone: true, showWeb: false });
  assert.deepEqual(c, [{ kind: 'email', value: 'a@b.ch' }]);
});
test('offerta di lavoro collegata all\'attività del titolare', () => {
  const b = { id: 'b', owner: 'Anna', name: 'Panificio Rossi', kind: 'azienda', desc: '', color: '#000', contacts: { showEmail: false, showPhone: false, showWeb: false }, createdAt: 1 };
  assert.equal(I.businessForJob([b], { owner: 'Anna', company: ' panificio rossi ' }).id, 'b');
  assert.equal(I.businessForJob([b], { owner: 'Bea', company: 'Panificio Rossi' }), null);
});

test('attività: serve la prova di titolarità', () => {
  assert.ok(I.validateBizProof(null));
  assert.ok(I.validateBizProof({ name: ' ', uri: 'x' }));
  assert.ok(I.validateBizProof({ name: 'visura.pdf', uri: '' }));
  assert.equal(I.validateBizProof({ name: 'visura.pdf', uri: 'file:///v.pdf' }), null);
  assert.equal(I.bizProofState({}), 'mancante');
  assert.equal(I.bizProofState({ proof: { status: 'in_verifica' } }), 'in_verifica');
  assert.equal(I.canPublishForBusiness({ proof: { status: 'verificata' } }), true);
  assert.equal(I.canPublishForBusiness({ proof: { status: 'in_verifica' } }), false);
  assert.equal(I.canPublishForBusiness({}), false);
});
