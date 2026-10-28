#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {installNetworkFence} from './offline-guard.mjs';
import {fixtureVersion, homes, profiles, prefilterProfile, freezeTree} from './home-fixtures.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scoringPath = path.join(root, 'src/lib/recommender/fitScoringV2.ts');

export async function firstMatch({write = true, output} = {}) {
  const fence = installNetworkFence();
  try {
    const scoring = await import(pathToFileURL(scoringPath).href);
    const inputs = structuredClone({homes, profiles, prefilterProfile});
    const before = JSON.stringify(inputs);
    freezeTree(inputs);
    const prefilter = inputs.homes.map(home => ({
      id: home.listing.id,
      ...scoring.calculatePreWpaFitScore(home.listing, inputs.prefilterProfile),
    }));
    const rankings = {};
    for (const [name, profile] of Object.entries(inputs.profiles)) {
      rankings[name] = scoring.scoreAndRankListingsV2(inputs.homes, profile).map(item => ({
        id: item.listing.id, title: item.listing.title,
        price_eur_purchase: item.listing.price, result: item.fitResult,
      }));
    }
    if (before !== JSON.stringify(inputs)) throw new Error('Shared analysis inputs changed.');
    if (fence.attempts.length) throw new Error('Network was attempted.');
    const receipt = {
      fixture: fixtureVersion,
      upstream_repository: 'latintzar/puedo_casa',
      upstream_commit: 'd461e9556f09ad526030376ab58643298e3a1fc8',
      runtime: process.version,
      source: {
        path: 'src/lib/recommender/fitScoringV2.ts',
        sha256: crypto.createHash('sha256').update(fs.readFileSync(scoringPath)).digest('hex'),
        preparation: 'WPA type contract extracted from the API route; numerical function bodies retained and neighborhood display labels clarified.',
      },
      input: {homes: inputs.homes.length, profiles: Object.keys(inputs.profiles).length,
        analysis_reused: true, data: 'Authored homes, prices, WPA and neighborhood scores.'},
      prefilter, rankings,
      network_attempts: 0, provider_model_calls: 0,
      scope: 'Original deterministic pre-WPA and fit calculations over authored cached-analysis-shaped inputs; cloud cache, photo analysis, commute and voice acceptance are separate.',
    };
    let receiptPath = null;
    if (write) {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'home-matching-'));
      fs.chmodSync(directory, 0o700);
      receiptPath = output ? path.resolve(output) : path.join(directory, 'first-match.json');
      if (receiptPath === root || receiptPath.startsWith(root + path.sep)) throw new Error('Choose a new receipt path outside the checkout.');
      fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {flag: 'wx', mode: 0o600});
    }
    return {receipt, receiptPath};
  } finally {
    fence.restore();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length && !(args.length === 2 && args[0] === '--output')) throw new Error('Use --output with a new private file path.');
  const {receipt, receiptPath} = await firstMatch({output: args[1]});
  console.log(JSON.stringify({
    receipt: receiptPath,
    homeOffice: receipt.rankings.homeOffice.map(item => ({id: item.id, score: item.result.score, pass: item.result.pass})),
    outdoorSpace: receipt.rankings.outdoorSpace.map(item => ({id: item.id, score: item.result.score, pass: item.result.pass})),
    network_attempts: 0, provider_model_calls: 0,
  }, null, 2));
}
