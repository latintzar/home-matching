import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {installNetworkFence} from '../tools/offline-guard.mjs';
import {homes, profiles, prefilterProfile, exampleAnalysis, scoreKeys} from '../tools/home-fixtures.mjs';
import {firstMatch} from '../tools/first-match.mjs';

const fence = installNetworkFence();
const scoring = await import('../src/lib/recommender/fitScoringV2.ts');
after(() => fence.restore());
const neutral = {...profiles.homeOffice, works_from_home: false, weights: {}, must_haves: {}};

test('the same authored analysis supports two different buyer priorities', async () => {
  const {receipt} = await firstMatch({write: false});
  assert.equal(receipt.rankings.homeOffice[0].id, 'synthetic-courtyard');
  assert.equal(receipt.rankings.outdoorSpace[0].id, 'synthetic-terrace');
  assert.equal(receipt.input.analysis_reused, true);
  assert.equal(receipt.network_attempts, 0);
  assert.equal(receipt.provider_model_calls, 0);
});

test('scoring leaves shared analysis, listings and profiles unchanged', () => {
  const input = structuredClone({homes, profiles});
  const before = structuredClone(input);
  scoring.scoreAndRankListingsV2(input.homes, input.profiles.homeOffice);
  scoring.scoreAndRankListingsV2(input.homes, input.profiles.outdoorSpace);
  assert.deepEqual(input, before);
});

test('a declared house-share dealbreaker fails before weighted scores', () => {
  const shared = structuredClone(homes[2].wpa);
  shared.scores = Object.fromEntries(scoreKeys.map(key => [key, 100]));
  const result = scoring.calculateFitScore(shared, neutral);
  assert.equal(result.pass, false);
  assert.equal(result.score, 0);
  assert.ok(result.failReason);
});

test('minimum required dimensions reject an otherwise passing home', () => {
  const profile = {...neutral, must_haves: {natural_light_intensity: 85}};
  assert.equal(scoring.calculateFitScore(homes[0].wpa, profile).pass, false);
  assert.equal(scoring.calculateFitScore(homes[1].wpa, profile).pass, true);
});

test('accessibility hazards follow the declared accommodation requirement', () => {
  const analysis = exampleAnalysis('synthetic-accessibility', {});
  analysis.safety_flags.accessibility_issues = ['Authored steps example'];
  assert.equal(scoring.calculateFitScore(analysis, neutral).pass, true);
  assert.equal(scoring.calculateFitScore(analysis, {...neutral, has_mobility_needs: true}).pass, false);
});

test('provided neighborhood context changes the actual weighted result', () => {
  const profile = {...neutral, weights: {neighborhood_quietness: 2}};
  const quiet = scoring.calculateFitScore(homes[0].wpa, profile, {scores: {quietness: 95}});
  const busy = scoring.calculateFitScore(homes[0].wpa, profile, {scores: {quietness: 15}});
  assert.ok(quiet.score > busy.score);
});

test('unknown dimensions stay outside the weighted denominator', () => {
  const analysis = exampleAnalysis('synthetic-partial', {});
  analysis.scores = Object.fromEntries(scoreKeys.map(key => [key, null]));
  analysis.scores.natural_light_intensity = 80;
  assert.equal(scoring.calculateFitScore(analysis, neutral).score, 80);
});

test('confidence penalty is applied independently from property dimensions', () => {
  const high = exampleAnalysis('synthetic-confidence', {});
  const low = {...high, confidence: 'low'};
  assert.equal(scoring.calculateFitScore(high, neutral).score - scoring.calculateFitScore(low, neutral).score, 5);
});

test('pre-WPA budget scoring is monotonic for the same listing', () => {
  const base = homes[0].listing;
  const within = scoring.calculatePreWpaFitScore({...base, price: 180000}, prefilterProfile);
  const above = scoring.calculatePreWpaFitScore({...base, price: 420000}, prefilterProfile);
  assert.ok(within.score > above.score);
  assert.ok(within.reasons.length > 0);
  assert.ok(above.reasons.length > 0);
});

test('weighted results remain inside the public zero-to-one-hundred range', () => {
  for (const value of [0, 100]) {
    const analysis = exampleAnalysis('synthetic-bounds', Object.fromEntries(scoreKeys.map(key => [key, value])));
    const result = scoring.calculateFitScore(analysis, profiles.outdoorSpace);
    assert.ok(result.score >= 0 && result.score <= 100);
  }
});

test('batch ordering keeps passing homes before failed constraints', () => {
  const result = scoring.scoreAndRankListingsV2(homes, profiles.homeOffice);
  assert.equal(result.at(-1).listing.id, 'synthetic-share');
  assert.equal(result.at(-1).fitResult.pass, false);
});

test('proof fence rejects a request before any transport is reached', () => {
  const isolated = installNetworkFence();
  try {
    assert.throws(() => fetch('https://synthetic.example.invalid'), /local source/);
    assert.equal(isolated.attempts.length, 1);
  } finally { isolated.restore(); }
});

test('street protection has the positive polarity used by fit scoring', () => {
  const weights = Object.fromEntries(scoreKeys.map(name => [name, 0]));
  weights.street_exposure = 1;
  const profile = {...profiles.homeOffice, works_from_home: false, weights};
  const low = scoring.calculateFitScore(exampleAnalysis('exposed', {street_exposure: 0}), profile);
  const high = scoring.calculateFitScore(exampleAnalysis('private', {street_exposure: 100}), profile);
  assert.ok(high.score > low.score);
});
