const { test } = require('node:test');
const assert = require('node:assert/strict');
const daily = require('../assets/daily-core.js');
const pool = n => Array.from({ length: n }, (_, id) => ({ id: id + 1 }));
const vm = require('node:vm');
const fs = require('node:fs');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../assets/artworks.js'),'utf8'), context);
const artworks = Array.from(context.window.BLOG_ARTWORKS);
const relations = require('../assets/artwork-relations.js');
test('Beijing midnight is independent of the device time zone', () => {
  assert.equal(daily.dayIndex('2026-11-23T15:59:59Z'), 0);
  assert.equal(daily.dayIndex('2026-11-23T16:00:00Z'), 1);
  assert.equal(daily.dateKey('2026-11-23T16:00:00Z'), '2026-11-24');
  assert.equal(daily.untilMidnight(Date.parse('2026-11-23T15:59:59Z')), 1080);
});
test('artwork hours advance at the exact hour while quote days only advance at Beijing midnight', () => {
  const before='2026-11-23T02:59:59.999Z', after='2026-11-23T03:00:00Z';
  assert.equal(daily.hourIndex(before),10);
  assert.equal(daily.hourIndex(after),11);
  assert.equal(daily.hourKey(after),'2026-11-23T11');
  assert.equal(daily.untilNextHour(before),81);
  assert.equal(daily.untilNextHour(after),3600080);
  assert.equal(daily.dayIndex(before),daily.dayIndex(after));
  const now=Date.now;
  try {
    Date.now=()=>Date.parse(before);
    const first=daily.pickArtworks(artworks,relations);
    Date.now=()=>Date.parse(after);
    assert.notDeepEqual(first.artworks.map(a=>a.id),daily.pickArtworks(artworks,relations).artworks.map(a=>a.id));
  } finally { Date.now=now; }
  assert.equal(daily.hourIndex('2026-11-22T16:00:00Z'),0);
  assert.equal(daily.hourIndex('2026-11-23T16:00:00Z'),24);
  assert.equal(daily.dayIndex('2026-11-23T16:00:00Z'),1);
});
test('refreshes, reordered rows and separate visitors have the same daily selection', () => {
  const input = pool(181);
  assert.deepEqual(daily.pick(input, 2, 12, 'artworks'), daily.pick(input.slice().reverse(), 2, 12, 'artworks'));
  assert.deepEqual(daily.pick(input, 2, 12, 'artworks'), daily.pick(input, 2, 12, 'artworks'));
  assert.notDeepEqual(daily.pick(input, 2, 12, 'artworks'), daily.pick(input, 2, 13, 'artworks'));
});
test('181 artworks cover every picture exactly once before restarting, across odd cycle boundaries', () => {
  const sequence = Array.from({ length: 181 }, (_, day) => daily.pick(pool(181), 2, day, 'artworks').map(item => item.id));
  for (const pair of sequence) assert.equal(new Set(pair).size, 2);
  const all = sequence.flat();
  assert.equal(new Set(all.slice(0, 181)).size, 181);
  assert.equal(new Set(all.slice(181, 362)).size, 181);
  assert.notDeepEqual(all.slice(0,181), all.slice(181,362));
});
test('small, empty and duplicate pools cannot produce duplicate cards on one day', () => {
  for (const count of [0,1,2,3,5,6]) for (let day = 0; day < 100; day++) {
    const picked = daily.pick([...pool(count), ...pool(count)], 2, day, 'test');
    assert.equal(picked.length, Math.min(2, count));
    assert.equal(new Set(picked.map(item => item.id)).size, picked.length);
  }
});
test('quotes cycle independently, with no repetition inside a cycle', () => {
  const rows = pool(11);
  const values = Array.from({ length:22 }, (_, day) => daily.pick(rows, 1, day, 'quotes')[0].id);
  assert.equal(new Set(values.slice(0,11)).size, 11);
  assert.equal(new Set(values.slice(11)).size, 11);
  assert.notDeepEqual(values.slice(0,11), values.slice(11));
});
test('Excel headers can move; empty rows and exact duplicates are ignored', () => {
  const quote = daily.normalizeQuotes([
    [], ['内容','作者','出处'], ['昨夜西风凋碧树，独上高楼，望尽天涯路。','晏殊','蝶恋花'],
    [], ['昨夜西风凋碧树，独上高楼，望尽天涯路。','晏殊','蝶恋花'], ['另一条','','']
  ]);
  assert.equal(quote.length, 2);
  assert.equal(quote[0].source, '蝶恋花');
  assert.equal(quote[1].author, '');
  assert.throws(() => daily.normalizeQuotes([['正文','作者','出处']]), /表头/);
  assert.throws(() => daily.normalizeQuotes([['内容','作者','出处'],['','','']]), /没有可展示/);
});

test('related hourly pairs are stable across reloads and catalogue order changes', () => {
  const first = daily.pickArtworks(artworks, relations, 12);
  assert.deepEqual(first, daily.pickArtworks(artworks.slice().reverse(), relations, 12));
  assert.deepEqual(first, daily.pickArtworks(artworks, relations, 12));
  assert.equal(first.artworks.length,2);
  assert.notDeepEqual(first.artworks.map(a=>a.id),daily.pickArtworks(artworks,relations,13).artworks.map(a=>a.id));
});

test('every pair has a registered relationship and every round contains distinct images', () => {
  const canonical = name => relations.aliases[name] || name;
  function known(a,b) {
    a=canonical(a); b=canonical(b);
    return a===b || relations.links.some(([x,y])=>canonical(x)===a && canonical(y)===b || canonical(x)===b && canonical(y)===a) ||
      relations.groups.some(group=>group.characters.map(canonical).includes(a) && group.characters.map(canonical).includes(b));
  }
  let day=0;
  const covered = new Set();
  for(let round=0;round<8;round++) {
    const opening=daily.pickArtworks(artworks,relations,day), ids=[];
    for(let i=0;i<opening.roundLength;i++) {
      const pair=daily.pickArtworks(artworks,relations,day++);
      assert.equal(pair.round,round);
      assert.ok(known(...pair.artworks.map(a=>a.character)));
      assert.ok(pair.relation);
      ids.push(...pair.artworks.map(a=>a.id));
      pair.artworks.forEach(a=>covered.add(a.id));
    }
    assert.equal(new Set(ids).size,ids.length,'an image cannot appear twice in a round');
  }
  const eligible=artworks.filter(a=>artworks.some(b=>a.id!==b.id && known(a.character,b.character)));
  assert.equal(covered.size,eligible.length,'unpaired images get another opportunity next round');
  assert.equal(covered.has(159),false,'unrelated portraits are not used to fill a pair');
});

test('rotation includes same-person portraits, Wu brothers and Dong Chao with Xue Ba', () => {
  const pairs=new Set(); let samePerson=false;
  for(let day=0;day<650;day++) {
    const pair=daily.pickArtworks(artworks,relations,day);
    pairs.add(pair.artworks.map(a=>a.character).sort().join('/'));
    samePerson ||= /不同画像/.test(pair.relation);
  }
  assert.ok(samePerson);
  assert.ok(pairs.has('武大/武松'));
  assert.ok(pairs.has('董超/薛霸'));
});

test('small relation pools rotate unmatched images and never force unrelated pairs', () => {
  const pictures=[{id:1,character:'甲'},{id:2,character:'乙'},{id:3,character:'丙'},{id:4,character:'孤图'}];
  const links={links:[['甲','乙','同伴'],['甲','丙','同伴']]};
  const seen=new Set();
  for(let day=0;day<2;day++) daily.pickArtworks(pictures,links,day).artworks.forEach(a=>seen.add(a.id));
  assert.deepEqual([...seen].sort(),[1,2,3]);
  assert.deepEqual(daily.pickArtworks(pictures,{},0).artworks,[]);
  assert.deepEqual(daily.pickArtworks([],links,0).artworks,[]);
  assert.equal(daily.pickArtworks([{id:1,character:'甲'},{id:2,character:'甲'}],{},0).artworks.length,2);
});
