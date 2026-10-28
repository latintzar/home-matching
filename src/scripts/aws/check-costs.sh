#!/bin/bash
# Check AWS costs and usage for PuedoCasa

echo "═══════════════════════════════════════════════════════════════"
echo "  AWS COST TRACKER - PuedoCasa"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Current S3 Usage
echo "📦 S3 STORAGE USAGE"
echo "-------------------"
S3_SIZE=$(aws s3 ls s3://puedo-casa-html-archive --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}')
S3_COUNT=$(aws s3 ls s3://puedo-casa-html-archive --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}')
S3_GB=$(echo "scale=3; ${S3_SIZE:-0} / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
S3_COST=$(echo "scale=2; ${S3_GB:-0} * 0.023" | bc 2>/dev/null || echo "0")

echo "  Files: ${S3_COUNT:-0}"
echo "  Size: ${S3_GB:-0} GB"
echo "  Est. Cost: \$${S3_COST:-0}/month"
echo ""

# Budget Status
echo "💰 BUDGET STATUS"
echo "----------------"
aws budgets describe-budgets --account-id 046651569176 --query 'Budgets[0].{Name:BudgetName,Limit:BudgetLimit.Amount,Spent:CalculatedSpend.ActualSpend.Amount}' --output table 2>/dev/null || echo "  (Budget info unavailable)"
echo ""

# Quick Cost Estimate
echo "📊 COST ESTIMATE (Based on current usage)"
echo "------------------------------------------"
echo "  S3 Storage:     \$${S3_COST:-0}/month"
echo "  DynamoDB:       \$0.00/month (not yet set up)"
echo "  Lambda:         \$0.00/month (free tier)"
echo "  API Gateway:    \$0.00/month (free tier)"
echo "  ─────────────────────────────"
echo "  TOTAL:          \$${S3_COST:-0}/month"
echo ""
echo "  Budget Limit:   \$30.00/month"
echo "  Headroom:       \$$(echo "30 - ${S3_COST:-0}" | bc)/month"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Run anytime: bash src/scripts/aws/check-costs.sh"
echo "═══════════════════════════════════════════════════════════════"

