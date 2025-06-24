'use strict';

// Import AWS SDK
const AWS = require('aws-sdk');
const sqs = new AWS.SQS();

/**
 * Task Submission API Lambda function
 * Accepts task submissions with a unique taskId and arbitrary JSON payload
 * and sends them to an SQS queue for asynchronous processing
 */
module.exports.handler = async (event) => {
  try {
    // Log the received event for debugging
    console.log('Received task submission event:', JSON.stringify(event, null, 2));
    
    // Parse the request body
    const body = JSON.parse(event.body || '{}');
    
    // Validate required fields
    if (!body.taskId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'taskId is required'
        })
      };
    }
    
    // Check if payload exists (can be any valid JSON value)
    if (body.payload === undefined) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          error: 'Bad Request',
          message: 'payload is required and must be a valid JSON value'
        })
      };
    }
    
    // Get the SQS queue URL from environment variables
    const queueUrl = process.env.TASK_QUEUE_URL;
    if (!queueUrl) {
      throw new Error('TASK_QUEUE_URL environment variable is not set');
    }
    
    // Prepare the message to send to SQS
    const message = {
      taskId: body.taskId,
      payload: body.payload,
      submittedAt: new Date().toISOString()
    };
    
    // Send the message to SQS
    const params = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageAttributes: {
        'TaskId': {
          DataType: 'String',
          StringValue: body.taskId
        }
      }
    };
    
    const result = await sqs.sendMessage(params).promise();
    console.log('Message sent to SQS:', result.MessageId);
    
    // Return success response
    const response = {
      success: true,
      message: 'Task submitted successfully to processing queue',
      taskId: body.taskId,
      messageId: result.MessageId,
      timestamp: new Date().toISOString()
    };
    
    return {
      statusCode: 202, // Accepted
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(response)
    };
  } catch (error) {
    console.error('Error in task submission handler:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: 'Internal Server Error',
        message: error.message
      })
    };
  }
};
