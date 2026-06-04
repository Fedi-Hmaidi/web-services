import dotenv from 'dotenv';
dotenv.config();

const loggingServiceUrl = process.env.LOGGING_SERVICE_URL || 'http://localhost:4005';

export async function logEvent(payload) {
  try {
    // Send in the background asynchronously
    fetch(`${loggingServiceUrl}/logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('Failed to send log to logging-service:', err.message);
    });
  } catch (err) {
    console.error('Logger helper error:', err.message);
  }
}
