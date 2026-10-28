import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';

const db = new DynamoDBClient({ region: 'us-east-1' });

async function count() {
  let total = 0;
  let lastKey: any = undefined;
  const domains = new Set<string>();
  
  do {
    const r = await db.send(new ScanCommand({ 
      TableName: 'leo-urls', 
      Select: 'SPECIFIC_ATTRIBUTES',
      ProjectionExpression: '#d',
      ExpressionAttributeNames: { '#d': 'domain' },
      ExclusiveStartKey: lastKey 
    }));
    total += r.Items?.length || 0;
    for (const item of r.Items || []) {
      if (item.domain?.S) domains.add(item.domain.S);
    }
    lastKey = r.LastEvaluatedKey;
  } while (lastKey);
  
  console.log(`Total URLs: ${total.toLocaleString()}`);
  console.log(`Unique domains: ${domains.size}`);
}

count();

