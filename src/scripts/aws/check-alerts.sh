#!/bin/bash
# AWS Alert Checker - Run this to see if anything is wrong
# Run: bash src/scripts/aws/check-alerts.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════════"
echo "  🚨 AWS ALERT CHECK - $(date)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Budget check
echo "💰 BUDGET CHECK:"
BUDGET_INFO=$(aws budgets describe-budgets --account-id 046651569176 --query 'Budgets[0]' --output json 2>/dev/null)
BUDGET_LIMIT=$(echo "$BUDGET_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['BudgetLimit']['Amount'])" 2>/dev/null || echo "30")
BUDGET_SPENT=$(echo "$BUDGET_INFO" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['CalculatedSpend']['ActualSpend']['Amount'])" 2>/dev/null || echo "0")
BUDGET_PCT=$(echo "scale=1; ($BUDGET_SPENT / $BUDGET_LIMIT) * 100" | bc 2>/dev/null || echo "0")

echo "   Limit: \$$BUDGET_LIMIT"
echo "   Spent: \$$BUDGET_SPENT"
echo "   Used:  $BUDGET_PCT%"

if (( $(echo "$BUDGET_PCT >= 80" | bc -l 2>/dev/null || echo 0) )); then
  echo -e "   ${RED}⚠️  WARNING: Over 80% of budget!${NC}"
elif (( $(echo "$BUDGET_PCT >= 50" | bc -l 2>/dev/null || echo 0) )); then
  echo -e "   ${YELLOW}⚡ Caution: Over 50% of budget${NC}"
else
  echo -e "   ${GREEN}✅ OK${NC}"
fi
echo ""

# S3 Size check
echo "📦 S3 SIZE CHECK:"
S3_BYTES=$(aws s3 ls s3://puedo-casa-html-archive --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}')
S3_GB=$(echo "scale=2; ${S3_BYTES:-0} / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
S3_OBJECTS=$(aws s3 ls s3://puedo-casa-html-archive --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}')
S3_LIMIT_GB=200

echo "   Size: ${S3_GB} GB / ${S3_LIMIT_GB} GB limit"
echo "   Objects: ${S3_OBJECTS:-0}"

if (( $(echo "$S3_GB >= 150" | bc -l 2>/dev/null || echo 0) )); then
  echo -e "   ${RED}⚠️  WARNING: Approaching 200GB limit!${NC}"
elif (( $(echo "$S3_GB >= 100" | bc -l 2>/dev/null || echo 0) )); then
  echo -e "   ${YELLOW}⚡ Caution: Over 100GB${NC}"
else
  echo -e "   ${GREEN}✅ OK${NC}"
fi
echo ""

# CloudWatch Alarms check
echo "🔔 CLOUDWATCH ALARMS:"
ALARMS=$(aws cloudwatch describe-alarms --state-value ALARM --query 'MetricAlarms[*].AlarmName' --output text 2>/dev/null)
if [ -z "$ALARMS" ]; then
  echo -e "   ${GREEN}✅ No alarms firing${NC}"
else
  echo -e "   ${RED}⚠️  ALARMS FIRING: $ALARMS${NC}"
fi
echo ""

# EC2 check
echo "🖥️  EC2 CHECK:"
EC2_RUNNING=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query 'Reservations[*].Instances[*].InstanceId' --output text 2>/dev/null)
if [ -z "$EC2_RUNNING" ]; then
  echo -e "   ${GREEN}✅ No instances running${NC}"
else
  echo -e "   ${YELLOW}⚡ Running instances: $EC2_RUNNING${NC}"
fi
echo ""

# Expensive services check
echo "💸 EXPENSIVE SERVICES CHECK:"
ALL_CLEAR=true

RDS=$(aws rds describe-db-instances --query 'DBInstances[*].DBInstanceIdentifier' --output text 2>/dev/null)
if [ -n "$RDS" ]; then
  echo -e "   ${RED}⚠️  RDS DATABASE RUNNING: $RDS${NC}"
  ALL_CLEAR=false
fi

NAT=$(aws ec2 describe-nat-gateways --query 'NatGateways[?State==`available`].NatGatewayId' --output text 2>/dev/null)
if [ -n "$NAT" ]; then
  echo -e "   ${RED}⚠️  NAT GATEWAY RUNNING: $NAT${NC}"
  ALL_CLEAR=false
fi

ELB=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerName' --output text 2>/dev/null)
if [ -n "$ELB" ]; then
  echo -e "   ${RED}⚠️  LOAD BALANCER RUNNING: $ELB${NC}"
  ALL_CLEAR=false
fi

if $ALL_CLEAR; then
  echo -e "   ${GREEN}✅ No expensive services running${NC}"
fi
echo ""

# Summary
echo "═══════════════════════════════════════════════════════════════"
if (( $(echo "$BUDGET_PCT >= 80" | bc -l 2>/dev/null || echo 0) )) || [ -n "$ALARMS" ] || [ -n "$RDS" ] || [ -n "$NAT" ] || [ -n "$ELB" ]; then
  echo -e "  ${RED}⚠️  ACTION REQUIRED - Check warnings above${NC}"
else
  echo -e "  ${GREEN}✅ ALL CLEAR - No issues detected${NC}"
fi
echo "═══════════════════════════════════════════════════════════════"

