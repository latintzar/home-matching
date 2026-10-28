# AWS Status & Monitoring Scripts

This document describes all scripts available for monitoring AWS resources, costs, and infrastructure status for the Leo platform.

---

## ⚠️ CRITICAL: Credentials Setup (Do This First!)

**Before ANY AWS command**, you must source and export credentials:

```bash
cd /Users/peterneyra/puedo_casa && source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION
```

### Verify Credentials Work
```bash
aws sts get-caller-identity
```

**Expected output:**
```json
{
    "UserId": "AIDAQVXFGOQMFPDDEAFIG",
    "Account": "046651569176",
    "Arn": "arn:aws:iam::000000000000:recipient-resource"
}
```

If you get `AuthFailure` or `InvalidAccessKeyId`, the credentials weren't exported properly.

---

## EC2 Instance Management

### Current Instances

| Name | Instance ID | Type | Purpose |
|------|-------------|------|---------|
| puedo-casa-nominatim | i-0890cad762bc0c8c7 | c5.xlarge | Geocoding service (3.230.148.50:8080) |
| harvest-1-a-l | i-027031cae3f1568bc | t3.medium | Harvest domains A-L |
| harvest-2-m-z | i-0c48f5db1f95a5439 | t3.medium | Harvest domains M-Z |

### Check All EC2 Status
```bash
source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
aws ec2 describe-instances \
  --filters "Name=instance-state-name,Values=running,stopped,pending" \
  --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name,PublicIpAddress,Tags[?Key==`Name`].Value|[0]]' \
  --output table
```

### SSH Into Harvest Instances

**Key file**: `~/.ssh/puedo-casa-harvest.pem`

```bash
# Get current IPs first
aws ec2 describe-instances --instance-ids i-027031cae3f1568bc i-0c48f5db1f95a5439 \
  --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value|[0],PublicIpAddress]' --output table

# SSH into Instance 1 (A-L)
ssh -o StrictHostKeyChecking=no -i ~/.ssh/puedo-casa-harvest.pem ubuntu@<IP>

# SSH into Instance 2 (M-Z)
ssh -o StrictHostKeyChecking=no -i ~/.ssh/puedo-casa-harvest.pem ubuntu@<IP>
```

### Check Harvest Logs (via SSH)

**Instance 1 (A-L):**
```bash
ssh -i ~/.ssh/puedo-casa-harvest.pem ubuntu@<IP> 'tail -50 /home/ubuntu/puedo_casa/harvest-a-l.log'
```

**Instance 2 (M-Z):**
```bash
ssh -i ~/.ssh/puedo-casa-harvest.pem ubuntu@<IP> 'tail -50 /home/ubuntu/puedo_casa/harvest-m-z.log'
```

### Check Running Processes on Instance
```bash
ssh -i ~/.ssh/puedo-casa-harvest.pem ubuntu@<IP> 'ps aux | grep -E "(tsx|node)" | grep -v grep'
```

### Terminate Instances (Cost Savings!)
```bash
# Terminate harvest instances when done (saves ~$0.042/hr)
aws ec2 terminate-instances --instance-ids i-027031cae3f1568bc i-0c48f5db1f95a5439

# Keep Nominatim running for geocoding
# To stop Nominatim: aws ec2 stop-instances --instance-ids i-0890cad762bc0c8c7
```

---

## Quick Reference

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `check-costs.sh` | Quick cost overview | Daily check |
| `check-alerts.sh` | Alert status check | Before/after deployments |
| `watch-costs.sh` | Live monitoring (5-min refresh) | During long-running jobs |
| `full-audit.sh` | Complete resource audit | Weekly audit |
| `cost-protection.ts` | Programmatic cost checks | In application code |
| `create-dynamodb-tables.ts` | DynamoDB setup | One-time setup |
| `launch-harvest-ec2.sh` | Launch harvest instances | When starting harvest |

---

## Shell Scripts

### 1. `check-costs.sh` - Quick Cost Overview

**Location**: `src/scripts/aws/check-costs.sh`

**Purpose**: Quick snapshot of current AWS costs and S3 usage.

**Run**:
```bash
bash src/scripts/aws/check-costs.sh
```

**Output**:
- S3 storage usage (files, GB, estimated cost)
- Budget status (spent vs limit)
- Cost breakdown by service
- Headroom remaining

**Sample Output**:
```
═══════════════════════════════════════════════════════════════
  AWS COST TRACKER - PuedoCasa
═══════════════════════════════════════════════════════════════

📦 S3 STORAGE USAGE
-------------------
  Files: 15,432
  Size: 2.340 GB
  Est. Cost: $0.05/month

💰 BUDGET STATUS
----------------
  PuedoCasa-Monthly  $30.00    $4.23

📊 COST ESTIMATE (Based on current usage)
------------------------------------------
  S3 Storage:     $0.05/month
  DynamoDB:       $0.00/month (not yet set up)
  Lambda:         $0.00/month (free tier)
  API Gateway:    $0.00/month (free tier)
  ─────────────────────────────
  TOTAL:          $0.05/month

  Budget Limit:   $30.00/month
  Headroom:       $29.95/month
```

---

### 2. `check-alerts.sh` - Alert Status Check

**Location**: `src/scripts/aws/check-alerts.sh`

**Purpose**: Check for any active warnings or problems across all AWS services.

**Run**:
```bash
bash src/scripts/aws/check-alerts.sh
```

**Checks**:
- ✅ Budget status (warns at 50%, 80%)
- ✅ S3 size (warns at 100GB, 150GB)
- ✅ CloudWatch alarms
- ✅ Running EC2 instances
- ✅ Expensive services (RDS, NAT Gateway, Load Balancers)

**Color-coded Output**:
- 🟢 Green: OK
- 🟡 Yellow: Caution
- 🔴 Red: Warning/Action Required

**Use Cases**:
- Before deploying new features
- After running batch jobs
- Daily health check
- When costs seem high

---

### 3. `watch-costs.sh` - Live Monitoring

**Location**: `src/scripts/aws/watch-costs.sh`

**Purpose**: Continuous monitoring that refreshes every 5 minutes. Ideal for long-running jobs.

**Run**:
```bash
bash src/scripts/aws/watch-costs.sh
# Press Ctrl+C to stop
```

**Displays**:
- Budget spent vs limit
- S3 object count and size
- Running EC2 instances
- Firing CloudWatch alarms

**Auto-Warnings**:
- ⚠️ Warns if CloudWatch alarms are firing
- ⚠️ Warns if EC2 instances are running
- 🚨 Critical alert if over 80% of budget

**Best For**:
- Running during harvest jobs
- Monitoring overnight batch processes
- Keeping an eye on costs during development

---

### 4. `full-audit.sh` - Complete Resource Audit

**Location**: `src/scripts/aws/full-audit.sh`

**Purpose**: Comprehensive audit of all AWS resources in use.

**Run**:
```bash
bash src/scripts/aws/full-audit.sh
```

**Audits**:
- Budget status (with table output)
- All S3 buckets and sizes
- All EC2 instances (ID, type, state)
- All DynamoDB tables
- All Lambda functions
- Expensive services (RDS, ElastiCache, NAT, ELB)

**Sample Output**:
```
═══════════════════════════════════════════════════════════════
  AWS FULL AUDIT - Mon Dec 1 2025
═══════════════════════════════════════════════════════════════

💰 BUDGET STATUS:
---------------------------------------------
|  Budget             |  Limit  |  Spent   |
---------------------------------------------
|  PuedoCasa-Monthly  |  30.00  |  4.23    |
---------------------------------------------

📦 S3 BUCKETS & SIZE:
  puedo-casa-html-archive: 15432 files, 2512789456 bytes

🖥️  EC2 INSTANCES:
  ✅ None running

⚡ DYNAMODB TABLES:
  leo-listings leo-scraping-rules leo-crawl-tracking

λ LAMBDA FUNCTIONS:
  daily-harvest-delta daily-parse detect-listing-status

🔴 EXPENSIVE SERVICES CHECK:
  ✅ RDS: None
  ✅ ElastiCache: None
  ✅ NAT Gateway: None
  ✅ Load Balancer: None
```

---

## TypeScript Scripts

### 5. `cost-protection.ts` - Programmatic Cost Protection

**Location**: `src/scripts/aws/cost-protection.ts`

**Purpose**: Enforces hard limits on S3 uploads to prevent cost overruns. Use in application code.

**Run Standalone**:
```bash
npx tsx src/scripts/aws/cost-protection.ts
```

**Import in Code**:
```typescript
import { canUpload, getBucketStats } from '@/scripts/aws/cost-protection';

// Check before uploading
const check = await canUpload(fileSize);
if (!check.allowed) {
  console.error(`Upload blocked: ${check.reason}`);
  return;
}

// Get current stats
const stats = await getBucketStats();
console.log(`Budget used: ${stats.budgetUsedPercent.toFixed(1)}%`);
```

**Configured Limits**:
| Limit | Value | Purpose |
|-------|-------|---------|
| `MAX_BUCKET_SIZE_GB` | 200 GB | Hard cap on S3 storage |
| `MAX_DAILY_UPLOADS` | 50,000 | Prevent runaway scripts |
| `MAX_FILE_SIZE_MB` | 10 MB | Reject oversized files |
| `MONTHLY_BUDGET_USD` | $30 | Budget limit |
| `WARNING_THRESHOLD_PCT` | 80% | Log warnings |
| `CRITICAL_THRESHOLD_PCT` | 95% | Log critical |
| `HARD_STOP_THRESHOLD_PCT` | 100% | Block uploads |

**Status Values**:
- `OK`: Under 80% budget
- `WARNING`: 80-95% budget
- `CRITICAL`: 95-100% budget
- `EXCEEDED`: Over 100% budget

---

### 6. `create-dynamodb-tables.ts` - DynamoDB Setup

**Location**: `src/scripts/aws/create-dynamodb-tables.ts`

**Purpose**: Create all DynamoDB tables needed for the Leo platform.

**Run**:
```bash
npx tsx src/scripts/aws/create-dynamodb-tables.ts
```

**Tables Created**:
| Table | Purpose | Keys |
|-------|---------|------|
| `leo-listings` | Core property data | domain (PK), listing_id (SK) |
| `leo-scraping-rules` | Learned selectors | domain (PK) |
| `leo-crawl-tracking` | Crawl metadata | domain (PK) |
| `leo-wpa-cache` | WPA results | listing_url (PK) |
| `leo-geo-intelligence` | Dossier system | geohash (PK), insight_id (SK) |
| `leo-market-velocity` | Sold/rented analytics | location_key (PK), period (SK) |
| `leo-analysis-cache` | Analysis results | listing_id (PK), analysis_type (SK) |

**Features**:
- Idempotent (safe to run multiple times)
- Creates GSIs for efficient queries
- Uses PAY_PER_REQUEST billing (no provisioned capacity)

---

### 7. `launch-harvest-ec2.sh` - Launch Harvest Instances

**Location**: `src/scripts/aws/launch-harvest-ec2.sh`

**Purpose**: Launch EC2 instances for running the harvest crawler.

**Run**:
```bash
bash src/scripts/aws/launch-harvest-ec2.sh
```

**What It Does**:
1. Creates key pair if needed
2. Launches t3.small instance with Ubuntu 22.04
3. Auto-installs Node.js 20 and dependencies
4. Clones repo and configures environment
5. Starts harvest crawler with resume mode

**Instance Details**:
- Type: `t3.small` (~$0.0208/hour)
- AMI: Ubuntu 22.04 LTS
- Estimated harvest time: 8-10 hours
- Estimated cost: ~$0.21

**After Launch**:
```bash
# SSH into instance
ssh -i ~/.ssh/puedo-casa-harvest.pem ubuntu@<PUBLIC_IP>

# Monitor harvest progress
tail -f /home/ubuntu/harvest.log

# Check S3 progress
aws s3 ls s3://puedo-casa-html-archive/html/ --recursive --summarize

# Terminate when done
aws ec2 terminate-instances --instance-ids <INSTANCE_ID>
```

---

## Recommended Workflow

### Daily Monitoring
```bash
# Quick check every morning
bash src/scripts/aws/check-alerts.sh
```

### During Harvest/Batch Jobs
```bash
# Keep this running in a separate terminal
bash src/scripts/aws/watch-costs.sh
```

### Weekly Audit
```bash
# Full resource audit
bash src/scripts/aws/full-audit.sh
```

### Before Major Deployments
```bash
# Check everything is clean
bash src/scripts/aws/check-alerts.sh
bash src/scripts/aws/full-audit.sh
```

---

## Troubleshooting

### Script Can't Access AWS
```bash
# Check AWS CLI is configured
aws sts get-caller-identity

# Check credentials are set
echo $AWS_ACCESS_KEY_ID

# Source .env.local if needed
source .env.local
```

### Budget Info Unavailable
The budget API requires specific IAM permissions:
```json
{
  "Effect": "Allow",
  "Action": ["budgets:ViewBudget", "budgets:DescribeBudgets"],
  "Resource": "*"
}
```

### EC2 Instance Type Blocked
If you see "Instance type not allowed", check the IAM deny policy:
- Current allowed types: `t3.micro`, `t3.small`, `t3.medium`
- Update `PuedoCasa-DenyExpensiveServices` policy to add more types

---

## Cost Reference

| Service | Rate | Our Limit |
|---------|------|-----------|
| S3 Storage | $0.023/GB/month | 200 GB |
| S3 Requests | $0.0004/1k GET | Unlimited |
| DynamoDB | $0.25/million reads | PAY_PER_REQUEST |
| EC2 t3.small | $0.0208/hour | Manual launch only |
| Lambda | Free tier (1M requests) | Free |

**Monthly Budget**: $30

---

## Environment Variables Required

```bash
# .env.local
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
AWS_S3_BUCKET=puedo-casa-html-archive
```

---

## S3 Bucket Management

### ⚠️ WARNING: Don't List All Files!

With 90k+ files, `aws s3 ls --recursive` will **timeout**. Use these instead:

### Quick Object Count (First Page Only)
```bash
aws s3api list-objects-v2 --bucket puedo-casa-html-archive --prefix html/ \
  --max-items 1000 --query 'length(Contents)' --output text
```

### Check Specific Domain
```bash
aws s3 ls s3://puedo-casa-html-archive/html/idealista.com/ --summarize
```

### Bucket Size (Use Cost Script Instead)
```bash
npx tsx src/scripts/aws/cost-protection.ts
```

---

## DynamoDB Status

### List All Tables
```bash
aws dynamodb list-tables --query 'TableNames' --output table
```

### Check Table Item Count
```bash
aws dynamodb describe-table --table-name leo-listings \
  --query 'Table.{Name:TableName,Items:ItemCount,Status:TableStatus}' --output table
```

### Scan Sample Items
```bash
aws dynamodb scan --table-name leo-listings --max-items 5 \
  --query 'Items[*].{domain:domain.S,listing_id:listing_id.S}'
```

---

## One-Liner Status Check

Copy-paste this for a quick full status:

```bash
cd /Users/peterneyra/puedo_casa && source .env.local && export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_REGION && \
echo "=== EC2 ===" && \
aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value|[0],InstanceType,PublicIpAddress]' --output table && \
echo "=== DynamoDB ===" && \
aws dynamodb list-tables --query 'TableNames' --output text && \
echo "=== Budget ===" && \
aws budgets describe-budgets --account-id 046651569176 \
  --query 'Budgets[0].{Limit:BudgetLimit.Amount,Spent:CalculatedSpend.ActualSpend.Amount}' --output table 2>/dev/null || echo "Budget API unavailable"
```

---

*Last Updated: December 1, 2025*

