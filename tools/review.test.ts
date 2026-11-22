import { expect, test } from 'bun:test';
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateFacts, type FactsFile } from '../src/facts';
import { applyReviews, approve, contentHash, readReviews } from './review-lib';

const REAL_FACTS = new URL('../assets/data/facts.json', import.meta.url).pathname;
const CLI = new URL('./review-facts.ts', import.meta.url).pathname;
const load = (): FactsFile => JSON.parse(readFileSync(REAL_FACTS, 'utf8'));
const run = (...a: string[]) => Bun.spawnSync(['bun', CLI, ...a], { stdout: 'pipe', stderr: 'pipe' });
const scratch = () => { const d = mkdtempSync(join(tmpdir(), 'review-')); copyFileSync(REAL_FACTS, join(d, 'facts.json')); return { facts: join(d, 'facts.json'), reviews: join(d, 'reviews.json') }; };

test('listing and showing change nothing and approve nothing', () => {
  const before = readFileSync(REAL_FACTS, 'utf8');
  const l = run(); expect(l.exitCode).toBe(0);
  expect(l.stdout.toString()).toContain('have not been checked by a person');
  const s = run('--show', 'mars'); expect(s.exitCode).toBe(0);
  const t = s.stdout.toString(); expect(t).toContain('What we know'); expect(t).toContain('What we do not know'); expect(t).toContain('Sources behind the numbers'); expect(t).toContain('https://');
  expect(readFileSync(REAL_FACTS, 'utf8')).toBe(before);
});

test('approve needs one id, a reviewer and a real note; there is no approve-all', () => {
  const { facts, reviews } = scratch();
  for (const a of [['--approve'], ['--approve', 'all', '--by', 'A', '--note', 'checked everything here'], ['--approve', 'mars'], ['--approve', 'mars', '--by', 'A'], ['--approve', 'mars', '--by', 'A', '--note', 'ok'], ['--approve', 'nonesuch', '--by', 'A', '--note', 'checked everything here']]) {
    const r = run(...a, '--file', facts, '--reviews', reviews); expect(r.exitCode, a.join(' ')).toBe(2);
  }
  expect(existsSync(reviews)).toBe(false);
  expect((JSON.parse(readFileSync(facts, 'utf8')) as FactsFile).entities.some((e) => e.humanReviewed)).toBe(false);
});

test('an explicit approve flips exactly that entity and records who, why and when', () => {
  const { facts, reviews } = scratch();
  const r = run('--approve', 'mars', '--by', 'Test Reviewer', '--note', 'numbers match the sheet; text read', '--file', facts, '--reviews', reviews);
  expect(r.exitCode).toBe(0);
  const f = JSON.parse(readFileSync(facts, 'utf8')) as FactsFile;
  expect(f.entities.filter((e) => e.humanReviewed).map((e) => e.id)).toEqual(['mars']);
  const mars = f.entities.find((e) => e.id === 'mars')!;
  expect(mars.review).toMatchObject({ by: 'Test Reviewer', note: 'numbers match the sheet; text read' }); expect(mars.review!.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(validateFacts(f)).toEqual([]);
  expect(Object.keys(readReviews(reviews).reviews)).toEqual(['mars']);
  expect(run('--revoke', 'mars', '--file', facts, '--reviews', reviews).exitCode).toBe(0);
  expect((JSON.parse(readFileSync(facts, 'utf8')) as FactsFile).entities.some((e) => e.humanReviewed)).toBe(false);
});

test('a review goes stale when the words or numbers change', () => {
  const f = load(); const mars = f.entities.find((e) => e.id === 'mars')!;
  const rec = approve(f, { version: 1, reviews: {} }, { id: 'mars', by: 'A', note: 'checked it properly', date: '2026-11-22' });
  const same = load(); expect(applyReviews(same.entities, rec).applied).toEqual(['mars']);
  const changed = load(); changed.entities.find((e) => e.id === 'mars')!.summary += ' (edited)';
  const res = applyReviews(changed.entities, rec); expect(res.stale).toEqual(['mars']); expect(changed.entities.find((e) => e.id === 'mars')!.humanReviewed).toBe(false);
  expect(contentHash(mars)).toBe(contentHash(load().entities.find((e) => e.id === 'mars')!));
  const g = load(); g.entities.find((e) => e.id === 'mars')!.facts[0].retrieved = '2030-01-01'; // re-reading a page does not undo a review
  expect(contentHash(g.entities.find((e) => e.id === 'mars')!)).toBe(contentHash(mars));
});

test('validation: checked without a reviewer, note and date is refused', () => {
  const f = load(); f.entities[0].humanReviewed = true;
  expect(validateFacts(f).join()).toContain('without a reviewer');
  const g = load(); g.entities[0].review = { by: 'A', note: 'n', date: '2026-11-22' };
  expect(validateFacts(g).join()).toContain('not marked as checked');
});

test('the shipped facts file has no review that was not recorded in tools/facts-reviews.json', () => {
  const rec = existsSync(new URL('./facts-reviews.json', import.meta.url)) ? Object.keys(readReviews(new URL('./facts-reviews.json', import.meta.url).pathname).reviews) : [];
  expect(load().entities.filter((e) => e.humanReviewed).map((e) => e.id).sort()).toEqual(rec.sort());
});
