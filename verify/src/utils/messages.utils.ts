export const EXCEPTION_MESSAGES = {
  SERVER_ERROR: `An unexpected error occurred. Please contact our support team, and we'll get this sorted for you as soon as possible!`,
  NOT_FOUND: 'The requested resource could not be found.',
  BAD_REQUEST: 'Invalid request.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  CONFLICT: 'Data conflict. Please try again.',
  VALIDATION_ERROR: 'Validation failed.',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later.',
  INTERNAL_SERVER_ERROR: 'Internal server error.',
  SERVICE_UNAVAILABLE: 'Service is currently unavailable.',
  TIMEOUT: 'Request timed out.',
};

export const RESPONSE_MESSAGES = {
  SUCCESS: 'Operation was successful.',
  CREATED: 'Resource has been created successfully.',
  UPDATED: 'Resource has been updated successfully.',
  DELETED: 'Resource has been deleted successfully.',
  SAVED: 'Data has been saved.',
  ACCEPTED: 'Request has been accepted for processing.',
  NO_CONTENT: 'Operation was successful but no content to return.',
  PARTIAL_CONTENT: 'Partial content returned.',
  NOT_MODIFIED: 'Resource has not been modified.',
  RESET_CONTENT: 'Reset content successfully.',
};
