# DLQ Example Project

This project demonstrates a serverless application using AWS services including API Gateway, Lambda, SQS, CloudWatch, and Step Functions.

## Architecture

- **API Gateway**: Exposes an HTTP endpoint to receive messages
- **Producer Lambda**: Receives HTTP requests and sends messages to SQS
- **SQS Queue**: Main queue for message processing
- **Dead Letter Queue (DLQ)**: Captures failed messages after multiple processing attempts
- **Consumer Lambda**: Processes messages from the SQS queue
- **Step Functions**: Handles complex message processing workflows
- **CloudWatch**: Monitors the system and alerts on DLQ messages

## Setup

### Prerequisites

- Node.js (v14+)
- AWS CLI configured with appropriate credentials
- Serverless Framework

### Installation

```bash
# Install dependencies
npm install
```

### Environment Variables

Copy the `.env.example` file to create your own `.env` file:

```bash
cp .env.example .env
```

Then edit the `.env` file to set your specific configuration values. The main variables you'll need to set are:

- `AWS_REGION`: Your AWS region (default: us-east-1)
- `AWS_PROFILE`: Your AWS CLI profile name (default: default)
- `STAGE`: Deployment stage (dev, staging, prod)

After deployment, update these values with the actual ARNs and URLs:
- `QUEUE_URL`: The URL of your SQS queue
- `DLQ_URL`: The URL of your Dead Letter Queue
- `STATE_MACHINE_ARN`: The ARN of your Step Function state machine
- `API_GATEWAY_URL`: The URL of your deployed API Gateway endpoint


### AWS Credentials and Permissions

To deploy this project, you need AWS credentials with the following permissions:

#### Required AWS Credentials

1. **AWS Access Key ID** and **AWS Secret Access Key** with permissions to:
   - Create and manage IAM roles and policies
   - Create and manage Lambda functions
   - Create and manage API Gateway resources
   - Create and manage SQS queues
   - Create and manage CloudWatch resources (logs, metrics, alarms)
   - Create and manage Step Functions
   - Create and manage SNS topics
   - Create and manage CloudFormation stacks

#### Minimum IAM Policy

Create an IAM user with the following managed policies:
** Work in progress **


For production environments, it's recommended to create a custom policy with more restricted permissions following the principle of least privilege.

#### Setting Up AWS Credentials

1. **Using AWS CLI**:
   ```bash
   aws configure --profile your-profile-name
   ```
   This will prompt you to enter your AWS Access Key ID, Secret Access Key, region, and output format.

2. **Using Environment Variables**:
   ```bash
   export AWS_REGION=eu-central-1
   export AWS_PROFILE=your-profile-name
   ```

3. **Using .env file** (for local development):
   ```
   AWS_REGION=eu-central-1
   AWS_PROFILE=your-profile-name
   ```

### Deployment

```bash
# Deploy to AWS
serverless deploy

# Deploy to a specific stage
serverless deploy --stage prod
```

## Usage

### Sending a message

```bash
curl -X POST https://your-api-endpoint/dev/produce \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello world", "type": "default"}'
```

### Simulating a failed message (will go to DLQ after 3 retries)

```bash
curl -X POST https://your-api-endpoint/dev/produce \
  -H "Content-Type: application/json" \
  -d '{"message": "This will fail", "simulateError": true}'
```

### Sending a complex message (will trigger Step Functions)

```bash
curl -X POST https://your-api-endpoint/dev/produce \
  -H "Content-Type: application/json" \
  -d '{"message": "Complex processing", "type": "complex"}'
```

## Monitoring

- Check CloudWatch Logs for Lambda function logs
- View the SQS queue metrics in CloudWatch
- Monitor the DLQ for failed messages
- Check Step Functions executions for complex message processing

## Local Development

```bash
# Run the service locally
serverless offline
```
