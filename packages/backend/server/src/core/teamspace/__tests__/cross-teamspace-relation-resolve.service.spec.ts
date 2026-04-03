import test from 'ava';

import { CrossTeamspaceRelationResolveService } from '../cross-teamspace-relation-resolve.service';

test('resolveRows returns tombstones when snapshot missing', async t => {
  const svc = new CrossTeamspaceRelationResolveService({
    doc: {
      getSnapshot: async () => null,
    },
  } as any);

  const rows = await svc.resolveRows('ws', 'doc', 'db', ['r1']);
  t.is(rows.length, 1);
  t.is(rows[0].rowId, 'r1');
  t.false(rows[0].exists);
  t.is(rows[0].title, '(unavailable)');
});

test('resolveRows returns tombstones when snapshot blob too small', async t => {
  const svc = new CrossTeamspaceRelationResolveService({
    doc: {
      getSnapshot: async () => ({ blob: new Uint8Array([1]) }),
    },
  } as any);

  const rows = await svc.resolveRows('ws', 'doc', 'db', ['a', 'b']);
  t.is(rows.length, 2);
  t.true(rows.every(r => !r.exists && r.title === '(unavailable)'));
});

test('resolveRows dedupes and caps row id batch size', async t => {
  const svc = new CrossTeamspaceRelationResolveService({
    doc: {
      getSnapshot: async () => null,
    },
  } as any);

  const ids = Array.from({ length: 100 }, (_, i) => `r${i}`);
  const rows = await svc.resolveRows('ws', 'doc', 'db', ['x', ...ids, 'x']);
  t.is(rows.length, 64);
  const seen = new Set(rows.map(r => r.rowId));
  t.is(seen.size, rows.length);
});
