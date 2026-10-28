#!/bin/bash
# Full AWS Audit - Run anytime to check what's running and costing money

echo "═══════════════════════════════════════════════════════════════"
echo "  AWS FULL AUDIT - $(date)"
echo "═══════════════════════════════════════════════════════════════"
echo ""

echo "💰 BUDGET STATUS:"
aws budgets describe-budgets --account-id 046651569176 \
  --query 'Budgets[0].{Budget:BudgetName,Limit:BudgetLimit.Amount,Spent:CalculatedSpend.ActualSpend.Amount}' \
  --output table 2>/dev/null || echo "  Unable to fetch"
echo ""

echo "📦 S3 BUCKETS & SIZE:"
for bucket in $(aws s3 ls 2>/dev/null | awk '{print $3}'); do
  size=$(aws s3 ls s3://$bucket --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}')
  count=$(aws s3 ls s3://$bucket --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}')
  echo "  $bucket: $count files, $size bytes"
done
echo ""

echo "🖥️  EC2 INSTANCES:"
instances=$(aws ec2 describe-instances --query 'Reservations[*].Instances[*].[InstanceId,InstanceType,State.Name]' --output text 2>/dev/null)
if [ -z "$instances" ]; then
  echo "  ✅ None running"
else
  echo "$instances"
fi
echo ""

echo "⚡ DYNAMODB TABLES:"
tables=$(aws dynamodb list-tables --query 'TableNames' --output text 2>/dev/null)
if [ -z "$tables" ]; then
  echo "  ✅ None"
else
  echo "  $tables"
fi
echo ""

echo "λ LAMBDA FUNCTIONS:"
lambdas=$(aws lambda list-functions --query 'Functions[*].FunctionName' --output text 2>/dev/null)
if [ -z "$lambdas" ]; then
  echo "  ✅ None"
else
  echo "  $lambdas"
fi
echo ""

echo "🔴 EXPENSIVE SERVICES CHECK:"
rds=$(aws rds describe-db-instances --query 'DBInstances[*].DBInstanceIdentifier' --output text 2>/dev/null)
elasticache=$(aws elasticache describe-cache-clusters --query 'CacheClusters[*].CacheClusterId' --output text 2>/dev/null)
nat=$(aws ec2 describe-nat-gateways --query 'NatGateways[?State==`available`].NatGatewayId' --output text 2>/dev/null)
elb=$(aws elbv2 describe-load-balancers --query 'LoadBalancers[*].LoadBalancerName' --output text 2>/dev/null)

[ -z "$rds" ] && echo "  ✅ RDS: None" || echo "  ⚠️  RDS: $rds"
[ -z "$elasticache" ] && echo "  ✅ ElastiCache: None" || echo "  ⚠️  ElastiCache: $elasticache"
[ -z "$nat" ] && echo "  ✅ NAT Gateway: None" || echo "  ⚠️  NAT Gateway: $nat"
[ -z "$elb" ] && echo "  ✅ Load Balancer: None" || echo "  ⚠️  Load Balancer: $elb"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "  Run anytime: bash src/scripts/aws/full-audit.sh"
echo "═══════════════════════════════════════════════════════════════"

