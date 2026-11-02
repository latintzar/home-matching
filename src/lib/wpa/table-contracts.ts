/** Separate cache shapes retain their original keys and payloads. */
import type {KeySchemaElement} from '@aws-sdk/client-dynamodb';

export const WPA_TABLE_NAMES = {
  modes: 'leo-wpa-cache',
  scores: 'leo-wpa-score-cache',
  shortlist: 'leo-wpa-shortlist-cache',
  urls: 'leo-wpa-url-cache',
} as const;

export const WPA_TABLE_KEYS = {
  modes: [{AttributeName:'listing_id',KeyType:'HASH'},{AttributeName:'wpa_mode',KeyType:'RANGE'}],
  scores: [{AttributeName:'listing_id',KeyType:'HASH'}],
  shortlist: [{AttributeName:'listing_id',KeyType:'HASH'}],
  urls: [{AttributeName:'listing_url',KeyType:'HASH'}],
} satisfies Record<keyof typeof WPA_TABLE_NAMES,KeySchemaElement[]>;
