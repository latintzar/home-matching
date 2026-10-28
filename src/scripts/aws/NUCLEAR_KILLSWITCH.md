# ☢️ AWS NUCLEAR KILLSWITCH

## The Problem
AWS has NO hard spending limit. Your credit card can be charged unlimited amounts.

## Our Protection Layers

### Layer 1: IAM Deny Policy (BLOCKS expensive actions)
This policy PREVENTS creating expensive resources even if a script goes crazy.

### Layer 2: Budget Alert (Emails you)
You get email at 80% of budget.

### Layer 3: Manual Killswitch Script
One command to FREEZE everything.

### Layer 4: Remove Credit Card (Ultimate protection)
AWS credits work without a card. No card = can't charge you.

---

## LAYER 1: IAM Deny Policy

This policy blocks:
- Creating EC2 instances larger than t3.micro
- Creating RDS databases
- Creating Lambda with high memory
- Any service we're not using

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyExpensiveEC2",
      "Effect": "Deny",
      "Action": "ec2:RunInstances",
      "Resource": "*",
      "Condition": {
        "ForAnyValue:StringNotLike": {
          "ec2:InstanceType": ["t3.micro", "t3.small", "t2.micro"]
        }
      }
    },
    {
      "Sid": "DenyRDS",
      "Effect": "Deny",
      "Action": "rds:*",
      "Resource": "*"
    },
    {
      "Sid": "DenyRedshift",
      "Effect": "Deny",
      "Action": "redshift:*",
      "Resource": "*"
    },
    {
      "Sid": "DenyEMR",
      "Effect": "Deny",
      "Action": "elasticmapreduce:*",
      "Resource": "*"
    },
    {
      "Sid": "DenySageMaker",
      "Effect": "Deny",
      "Action": "sagemaker:*",
      "Resource": "*"
    },
    {
      "Sid": "DenyElastiCache",
      "Effect": "Deny",
      "Action": "elasticache:*",
      "Resource": "*"
    }
  ]
}
```

## LAYER 3: Manual Killswitch

Run this to IMMEDIATELY freeze everything:

```bash
# EMERGENCY: Delete all S3 objects and freeze account
aws s3 rm s3://puedo-casa-html-archive --recursive
aws iam attach-user-policy --user-name YOUR_USER --policy-arn arn:aws:iam::aws:policy/AWSDenyAll
```

## LAYER 4: Remove Credit Card

1. Go to AWS Console → Billing → Payment Methods
2. Remove credit card
3. AWS credits still work
4. When credits run out, services stop (can't charge you)

---

## Maximum Safe Configuration

For your situation, I recommend:

1. ✅ Use ONLY these services:
   - S3 (storage)
   - Lambda (free tier)
   - DynamoDB (on-demand, pay-per-use)

2. ✅ Set daily spending alerts at $1, $5, $10

3. ✅ Apply IAM deny policy for expensive services

4. ✅ Keep credit card but set up ALL alerts

5. ✅ Check costs DAILY with our script

---

## Your Current Risk

With our setup:
- S3 60GB = $1.38/month MAX
- DynamoDB = $2-3/month MAX  
- Lambda = FREE
- Total realistic max = $10/month

Even if everything goes 10x wrong = $100/month
Not $1,500 like Google Cloud Maps (which charges per API call)

AWS S3/DynamoDB are STORAGE - they don't have per-request costs that can explode.

