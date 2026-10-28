#!/bin/bash
# AWS Cost Watcher - Runs continuously, checks every 5 minutes
# Run: bash src/scripts/aws/watch-costs.sh
# Stop: Ctrl+C

echo "═══════════════════════════════════════════════════════════════"
echo "  🔍 AWS COST WATCHER - Monitoring every 5 minutes"
echo "  Press Ctrl+C to stop"
echo "═══════════════════════════════════════════════════════════════"
echo ""

while true; do
  clear
  echo "═══════════════════════════════════════════════════════════════"
  echo "  🔍 AWS COST WATCHER - $(date)"
  echo "  Next check in 5 minutes... (Ctrl+C to stop)"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  
  # Quick status
  BUDGET_SPENT=$(aws budgets describe-budgets --account-id 046651569176 \
    --query 'Budgets[0].CalculatedSpend.ActualSpend.Amount' --output text 2>/dev/null || echo "?")
  
  S3_OBJECTS=$(aws s3 ls s3://puedo-casa-html-archive --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}')
  S3_SIZE=$(aws s3 ls s3://puedo-casa-html-archive --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}')
  S3_GB=$(echo "scale=3; ${S3_SIZE:-0} / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
  
  EC2_COUNT=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" \
    --query 'length(Reservations[*].Instances[*])' --output text 2>/dev/null || echo "0")
  
  ALARMS=$(aws cloudwatch describe-alarms --state-value ALARM \
    --query 'length(MetricAlarms)' --output text 2>/dev/null || echo "0")
  
  echo "  💰 Budget Spent:     \$$BUDGET_SPENT / \$30"
  echo "  📦 S3 Objects:       ${S3_OBJECTS:-0}"
  echo "  📦 S3 Size:          ${S3_GB} GB"
  echo "  🖥️  EC2 Running:      ${EC2_COUNT:-0}"
  echo "  🔔 Alarms Firing:    ${ALARMS:-0}"
  echo ""
  
  # Warning checks
  if [ "$ALARMS" != "0" ] && [ -n "$ALARMS" ]; then
    echo "  ⚠️  WARNING: CloudWatch alarms are firing!"
  fi
  
  if [ "$EC2_COUNT" != "0" ] && [ -n "$EC2_COUNT" ]; then
    echo "  ⚠️  WARNING: EC2 instances are running!"
  fi
  
  SPENT_NUM=$(echo "$BUDGET_SPENT" | tr -d '$' 2>/dev/null || echo "0")
  if (( $(echo "${SPENT_NUM:-0} > 24" | bc -l 2>/dev/null || echo 0) )); then
    echo "  🚨 CRITICAL: Over 80% of budget!"
  fi
  
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  
  sleep 300  # 5 minutes
done

