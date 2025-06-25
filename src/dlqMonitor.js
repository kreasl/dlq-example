'use strict';

const AWS = require('aws-sdk');
const cloudWatchLogs = new AWS.CloudWatchLogs();

// Define log group name
const LOG_GROUP_NAME = `dlq-example-${process.env.STAGE || 'dev'}-monitorDlq`;

// Store the log stream name for the current Lambda invocation
let currentLogStreamName = null;
let logStreamCreated = false;

/**
 * Helper function to log to a specific CloudWatch log group
 * Uses a single stream per Lambda function invocation
 */
async function logToCloudWatch(message, logLevel = 'INFO') {
  // Also log to standard Lambda logs for debugging
  console.log(`[${logLevel}] ${message}`);
  
  const timestamp = new Date().getTime();
  
  // Create a stream name only once per Lambda invocation
  if (!currentLogStreamName) {
    currentLogStreamName = `dlq-monitor-${timestamp}`;
  }
  
  try {
    // Create log group if it doesn't exist (only once)
    if (!logStreamCreated) {
      try {
        await cloudWatchLogs.createLogGroup({
          logGroupName: LOG_GROUP_NAME
        }).promise();
        console.log(`Created log group: ${LOG_GROUP_NAME}`);
      } catch (error) {
        // Ignore if log group already exists
        if (error.code !== 'ResourceAlreadyExistsException') {
          console.error('Error creating log group:', error);
        }
      }
    }
    
    // Create log stream (only once per Lambda invocation)
    if (!logStreamCreated) {
      try {
        await cloudWatchLogs.createLogStream({
          logGroupName: LOG_GROUP_NAME,
          logStreamName: currentLogStreamName
        }).promise();
        logStreamCreated = true;
      } catch (error) {
        console.error('Error creating log stream:', error);
        return; // Exit but don't throw to allow function to continue
      }
    }
    
    // Put log events to the same stream for this invocation
    await cloudWatchLogs.putLogEvents({
      logGroupName: LOG_GROUP_NAME,
      logStreamName: currentLogStreamName,
      logEvents: [
        {
          timestamp,
          message: `[${logLevel}] ${message}`
        }
      ]
    }).promise();
  } catch (error) {
    console.error('Error writing to CloudWatch logs:', error);
  }
}

/**
 * DLQ Monitor Lambda function
 * Monitors the Dead Letter Queue and logs details of failed tasks
 * This function is triggered when messages arrive in the DLQ
 */
module.exports.handler = async (event) => {
  try {
    await logToCloudWatch(`DLQ Monitor received event: ${JSON.stringify(event, null, 2)}`, 'INFO');
    
    // Process each record (message) from the DLQ
    for (const record of event.Records) {
      try {
        // Parse the message body
        const message = JSON.parse(record.body);
        const { taskId, payload, submittedAt } = message;
        
        // Calculate how long the message was in the system before ending up in DLQ
        const submittedDate = new Date(submittedAt);
        const currentDate = new Date();
        const timeInSystem = Math.floor((currentDate - submittedDate) / 1000); // in seconds
        
        // Extract SQS message attributes
        const messageId = record.messageId;
        const sentTimestamp = record.attributes.SentTimestamp;
        const approximateFirstReceiveTimestamp = record.attributes.ApproximateFirstReceiveTimestamp;
        const approximateReceiveCount = record.attributes.ApproximateReceiveCount;
        
        // Log detailed information about the failed task to a new stream
        const detailedLogMessage = [
          '========== FAILED TASK DETAILS ==========',
          `Task ID: ${taskId}`,
          `Message ID: ${messageId}`,
          `Time in system: ${timeInSystem} seconds`,
          `Originally submitted at: ${submittedAt}`,
          `Sent to queue at: ${new Date(parseInt(sentTimestamp)).toISOString()}`,
          `First received at: ${new Date(parseInt(approximateFirstReceiveTimestamp)).toISOString()}`,
          `Total receive count: ${approximateReceiveCount}`,
          'Payload:',
          JSON.stringify(payload, null, 2),
          '========================================'
        ].join('\n');
        console.log(detailedLogMessage);
        
        // This will create a new log stream for each failed task
        await logToCloudWatch(detailedLogMessage, 'ERROR');
        
        // In a real-world scenario, you might want to:
        // 1. Store failed task details in a database
        // 2. Send notifications to administrators
        // 3. Attempt special recovery procedures
        // 4. Move the message to a different queue for manual processing
        
        // For this example, we're just logging the details to CloudWatch
        
      } catch (recordError) {
        await logToCloudWatch(`Error processing DLQ record: ${recordError.message}`, 'ERROR');
      }
    }
    
    // Return success
    return {
      batchItemFailures: [] // We're not failing any messages in the DLQ monitor
    };
  } catch (error) {
    await logToCloudWatch(`Error in DLQ monitor: ${error.message}`, 'ERROR');
    throw error;
  }
};
