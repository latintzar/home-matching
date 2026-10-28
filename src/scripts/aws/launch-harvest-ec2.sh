#!/bin/bash
# Launch EC2 instance for harvest with resume capability
# Uses t3.medium ON-DEMAND (not spot) to avoid interruption

set -e

# Configuration
INSTANCE_TYPE="t3.small"  # t3.medium blocked by IAM deny policy
AMI_ID="ami-0c7217cdde317cfec"  # Ubuntu 22.04 LTS
KEY_NAME="puedo-casa-harvest"
SECURITY_GROUP="sg-0872def2f6936fc5c"  # puedo-casa-harvest-sg (allows SSH)
REGION="us-east-1"

echo "🚀 Launching EC2 Harvest Instance"
echo "=================================="
echo "Instance type: $INSTANCE_TYPE (on-demand, ~\$0.0208/hr)"
echo "Estimated time: 8-10 hours"
echo "Estimated cost: ~\$0.21"
echo ""

# Check if key pair exists
if ! aws ec2 describe-key-pairs --key-names $KEY_NAME --region $REGION &>/dev/null; then
  echo "⚠️ Key pair not found. Creating..."
  aws ec2 create-key-pair --key-name $KEY_NAME --region $REGION \
    --query 'KeyMaterial' --output text > ~/.ssh/$KEY_NAME.pem
  chmod 400 ~/.ssh/$KEY_NAME.pem
  echo "✅ Created key pair: ~/.ssh/$KEY_NAME.pem"
fi

# User data script for EC2
USER_DATA=$(cat << 'STARTUP'
#!/bin/bash
set -e
exec > >(tee /var/log/harvest-startup.log) 2>&1
echo "=== HARVEST STARTUP $(date) ==="

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Clone repo
cd /home/ubuntu
git clone https://github.com/pneyra/puedo_casa.git || echo "Repo exists"
cd puedo_casa

# Create .env.local with AWS credentials
cat > .env.local << 'ENV'
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=puedo-casa-html-archive
ENV

# Install dependencies
npm install

# Run harvest with RESUME mode (skips already-crawled domains)
echo "=== STARTING HARVEST WITH RESUME $(date) ==="
nohup npx tsx src/scripts/harvest_agencies/s3-html-crawler.ts --resume > /home/ubuntu/harvest.log 2>&1 &

echo "=== HARVEST STARTED, PID: $! ==="
echo "Monitor with: tail -f /home/ubuntu/harvest.log"
STARTUP
)

# Launch instance
echo "Launching instance..."
INSTANCE_ID=$(aws ec2 run-instances \
  --image-id $AMI_ID \
  --instance-type $INSTANCE_TYPE \
  --key-name $KEY_NAME \
  --security-group-ids $SECURITY_GROUP \
  --user-data "$USER_DATA" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=puedo-casa-harvest},{Key=Project,Value=puedo-casa}]" \
  --region $REGION \
  --query 'Instances[0].InstanceId' \
  --output text)

echo "✅ Instance launched: $INSTANCE_ID"
echo ""
echo "Waiting for instance to start..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --region $REGION \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo ""
echo "==================================="
echo "✅ HARVEST EC2 LAUNCHED"
echo "==================================="
echo "Instance ID: $INSTANCE_ID"
echo "Public IP:   $PUBLIC_IP"
echo ""
echo "SSH into instance:"
echo "  ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$PUBLIC_IP"
echo ""
echo "Monitor harvest:"
echo "  ssh -i ~/.ssh/$KEY_NAME.pem ubuntu@$PUBLIC_IP 'tail -f harvest.log'"
echo ""
echo "Check S3 progress:"
echo "  aws s3 ls s3://puedo-casa-html-archive/html/ --recursive --summarize"
echo ""
echo "To terminate when done:"
echo "  aws ec2 terminate-instances --instance-ids $INSTANCE_ID"

