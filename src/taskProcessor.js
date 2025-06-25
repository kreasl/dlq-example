'use strict';

// Import AWS SDK
const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

module.exports.handler = async (event) => {
  try {
    console.log('Received SQS event:', JSON.stringify(event, null, 2));
    
    // Track failed message receipt handles
    const failedMessageReceipts = [];
    
    // Process each record (message) from SQS
    for (const record of event.Records) {
      try {
        // Parse the message body
        const message = JSON.parse(record.body);
        const { taskId, payload } = message;
        
        // Get the approximate receive count (how many times this message has been received)
        const approximateReceiveCount = parseInt(record.attributes.ApproximateReceiveCount || '1');
        
        console.log(`Processing task ${taskId} (Attempt #${approximateReceiveCount})...`);
        console.log(`Task details: ${JSON.stringify(payload, null, 2)}`);
        
        // Simulate processing time (1-3 seconds)
        const processingTime = Math.floor(Math.random() * 2000) + 1000;
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        // Randomly fail 30% of runs
        // const shouldFail = Math.random() < 0.3; // 30% of runs will fail
        const shouldFail = Math.random() < 1; // Always fail  

        if (shouldFail) {
          console.log(`Task ${taskId} failed (simulated failure, attempt #${approximateReceiveCount})`);
          
          // Implement true exponential backoff
          // Calculate backoff time: baseDelay * 2^(attempt-1)
          // For example: 30 seconds for first retry, 60 seconds for second retry
          const baseDelay = 10; // seconds
          const maxDelay = 900; // 15 minutes (maximum visibility timeout)
          const backoffDelay = Math.min(
            Math.ceil(Math.pow(1.5, approximateReceiveCount - 1)) * baseDelay,
            maxDelay
          );
          
          // Log retry information with exponential backoff details
          if (approximateReceiveCount === 1) {
            console.log(`Task ${taskId} will be retried with exponential backoff in ${backoffDelay} seconds`);
          } else if (approximateReceiveCount === 2) {
            console.log(`Task ${taskId} failed second attempt, will retry in ${backoffDelay} seconds`);
          } else {
            console.log(`Task ${taskId} has failed maximum retry attempts, will be sent to DLQ`);
          }
          
          // Only apply custom visibility timeout if we haven't reached max retries
          if (approximateReceiveCount < 3) {
            try {
              // Get the queue URL from environment variables
              const queueUrl = process.env.TASK_QUEUE_URL;
              if (!queueUrl) {
                throw new Error('TASK_QUEUE_URL environment variable is not set');
              }
              
              // Change the visibility timeout for this specific message
              await sqs.changeMessageVisibility({
                QueueUrl: queueUrl,
                ReceiptHandle: record.receiptHandle,
                VisibilityTimeout: backoffDelay
              }).promise();
              
              console.log(`Set visibility timeout to ${backoffDelay} seconds for task ${taskId}`);
            } catch (visibilityError) {
              console.error('Error setting visibility timeout:', visibilityError);
              // If we can't set the visibility timeout, we'll fall back to the queue's default
            }
          }
          
          // Add the receipt handle to the failed list
          failedMessageReceipts.push(record.receiptHandle);
          
          // Throw an error to trigger the retry mechanism
          throw new Error(`Simulated failure for task ${taskId}`);
        }
        
        // If we get here, the task was processed successfully
        console.log(`Task ${taskId} processed successfully in ${processingTime}ms`);
        
        // In a real implementation, you might:
        // 1. Update a database with the task status
        // 2. Trigger additional workflows
        // 3. Send notifications
      } catch (recordError) {
        // Handle individual record processing errors
        console.error('Error processing record:', recordError);
        
        // Add the receipt handle to the failed list
        failedMessageReceipts.push(record.receiptHandle);
        
        // We don't re-throw here because we want to process all records
        // and then report the failures at the end
      }
    }
    
    // For SQS integration with Lambda, we need to ensure proper reporting of failures
    // When a Lambda function processes messages from an SQS queue, it needs to explicitly
    // tell SQS which messages failed processing so they can be retried or sent to DLQ
    if (failedMessageReceipts.length > 0) {
      console.log(`Reporting ${failedMessageReceipts.length} failed messages to SQS`);

      return {
        batchItemFailures: failedMessageReceipts.map(receipt => ({
          itemIdentifier: receipt
        }))
      };
    } else {
      return {
        batchItemFailures: []
      };
    }
  } catch (error) {
    console.error('Error in task processor:', error);
    throw error; // Re-throw to let Lambda and SQS handle the failure
  }
};
