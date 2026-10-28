/**
 * Harvest Alerts
 * 
 * Send email notifications for harvest phase completions.
 * Email: operator@example.invalid
 * 
 * Setup (run once):
 *   npx tsx src/harvest/alerts.ts --setup
 * 
 * Test:
 *   npx tsx src/harvest/alerts.ts --test
 */

import { 
  SNSClient, 
  PublishCommand, 
  CreateTopicCommand,
  SubscribeCommand,
  ListSubscriptionsByTopicCommand 
} from '@aws-sdk/client-sns';
import { HARVEST_CONFIG } from './config';

const sns = new SNSClient({ region: HARVEST_CONFIG.aws.region });
const ALERT_EMAIL = HARVEST_CONFIG.alerts.email; // operator@example.invalid

export interface PhaseResult {
  phase: string;
  domainsProcessed: number;
  pagesDownloaded: number;
  listingsFound: number;
  truncatedDomains: number;
  errors: number;
  durationMinutes: number;
  estimatedCost: number;
}

export async function sendPhaseCompleteAlert(result: PhaseResult): Promise<void> {
  const subject = `Leo Harvest: ${result.phase} Complete ✅`;
  
  const message = `
Leo Harvest Phase Complete
==========================

Phase: ${result.phase}
Status: ✅ Complete

STATS:
- Domains processed: ${result.domainsProcessed}
- Pages downloaded: ${result.pagesDownloaded.toLocaleString()}
- Listings found: ${result.listingsFound.toLocaleString()}
- Truncated domains: ${result.truncatedDomains}
- Errors: ${result.errors}

PERFORMANCE:
- Duration: ${result.durationMinutes.toFixed(1)} minutes
- Estimated cost: $${result.estimatedCost.toFixed(2)}

${result.truncatedDomains > 0 ? `
⚠️ ${result.truncatedDomains} domains hit the 1000 page limit.
Review these in DynamoDB table: ${HARVEST_CONFIG.aws.dynamodb.crawlStatusTable}
` : ''}
---
Leo Harvest System
  `.trim();

  await sns.send(new PublishCommand({
    TopicArn: HARVEST_CONFIG.aws.snsTopicArn,
    Subject: subject,
    Message: message,
  }));

  console.log(`📧 Phase completion alert sent: ${result.phase}`);
}

export async function sendErrorAlert(phase: string, error: string): Promise<void> {
  const subject = `Leo Harvest: ${phase} FAILED ❌`;
  
  const message = `
Leo Harvest Phase FAILED
========================

Phase: ${phase}
Status: ❌ Failed

ERROR:
${error}

Please check CloudWatch logs for details.

---
Leo Harvest System
  `.trim();

  await sns.send(new PublishCommand({
    TopicArn: HARVEST_CONFIG.aws.snsTopicArn,
    Subject: subject,
    Message: message,
  }));

  console.log(`📧 Error alert sent: ${phase}`);
}

export async function sendTestAlert(): Promise<void> {
  await sns.send(new PublishCommand({
    TopicArn: HARVEST_CONFIG.aws.snsTopicArn,
    Subject: 'Leo Harvest: Test Alert',
    Message: `This is a test alert from the Leo Harvest system.\n\nIf you received this at ${ALERT_EMAIL}, alerts are working!\n\n---\nLeo Harvest System`,
  }));

  console.log(`📧 Test alert sent to ${ALERT_EMAIL}`);
}

/**
 * Setup SNS topic and email subscription
 */
export async function setupAlerts(): Promise<void> {
  console.log('🔧 Setting up harvest alerts...\n');
  
  // Check if topic exists or create it
  const topicName = 'leo-harvest-alerts';
  console.log(`1. Creating/verifying SNS topic: ${topicName}`);
  
  const createTopicResult = await sns.send(new CreateTopicCommand({
    Name: topicName,
  }));

  const topicArn = createTopicResult.TopicArn;
  console.log(`   ✅ Topic ARN: ${topicArn}`);
  
  // Check existing subscriptions
  console.log(`\n2. Checking subscriptions for ${ALERT_EMAIL}...`);
  
  const subscriptions = await sns.send(new ListSubscriptionsByTopicCommand({
    TopicArn: topicArn,
  }));
  
  const existingSub = subscriptions.Subscriptions?.find(
    s => s.Protocol === 'email' && s.Endpoint === ALERT_EMAIL
  );
  
  if (existingSub) {
    if (existingSub.SubscriptionArn === 'PendingConfirmation') {
      console.log(`   ⚠️ Subscription pending - check ${ALERT_EMAIL} for confirmation email`);
    } else {
      console.log(`   ✅ Already subscribed: ${ALERT_EMAIL}`);
    }
  } else {
    console.log(`   📧 Subscribing ${ALERT_EMAIL}...`);
    
    await sns.send(new SubscribeCommand({
      TopicArn: topicArn,
      Protocol: 'email',
      Endpoint: ALERT_EMAIL,
    }));
    
    console.log(`   ✅ Subscription created - CHECK EMAIL for confirmation link!`);
  }
  
  console.log(`\n3. Update config if needed:`);
  console.log(`   Current: ${HARVEST_CONFIG.aws.snsTopicArn}`);
  console.log(`   New:     ${topicArn}`);
  
  if (HARVEST_CONFIG.aws.snsTopicArn !== topicArn) {
    console.log(`\n   ⚠️ Update src/harvest/config.ts with new topic ARN!`);
  }
  
  console.log('\n✅ Setup complete!');
  console.log(`\nTo test, run: npx tsx src/harvest/alerts.ts --test`);
}

/**
 * Send daily harvest summary
 */
export async function sendDailySummary(stats: {
  domainsChecked: number;
  newUrls: number;
  newListings: number;
  errors: number;
  duration: string;
}): Promise<void> {
  const subject = `Leo Harvest: Daily Summary 📊`;
  
  const message = `
Leo Harvest Daily Summary
=========================

Date: ${new Date().toISOString().split('T')[0]}

STATS:
- Domains checked: ${stats.domainsChecked.toLocaleString()}
- New URLs found: ${stats.newUrls.toLocaleString()}
- New listings: ${stats.newListings.toLocaleString()}
- Errors: ${stats.errors}

DURATION: ${stats.duration}

---
Leo Harvest System
  `.trim();

  await sns.send(new PublishCommand({
    TopicArn: HARVEST_CONFIG.aws.snsTopicArn,
    Subject: subject,
    Message: message,
  }));

  console.log('📧 Daily summary sent');
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--setup')) {
    setupAlerts().catch(console.error);
  } else if (args.includes('--test')) {
    sendTestAlert().catch(console.error);
  } else {
    console.log('Leo Harvest Alerts');
    console.log('==================\n');
    console.log('Commands:');
    console.log('  npx tsx src/harvest/alerts.ts --setup   Set up SNS topic and email subscription');
    console.log('  npx tsx src/harvest/alerts.ts --test    Send test alert email');
    console.log(`\nEmail: ${ALERT_EMAIL}`);
  }
}

