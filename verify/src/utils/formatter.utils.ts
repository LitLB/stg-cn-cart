export function convertToThailandMobile(mobile: string): string {

  if (mobile.length < 10 || mobile.length > 10) {
    throw {
      status: 400,
      statusCode: '409',
      statusMessage: 'Invalid mobile number',
      errorCode: 'INVALID_MOBILE_NUMBER'
    }
  }

  const sanitized = mobile.replace(/\D/g, '');

  if (sanitized.startsWith('0')) {
    return '66' + sanitized.substring(1);
  }

  if (sanitized.length === 11 && sanitized.startsWith('6')) {
    return sanitized
  }

  throw {
    status: 400,
    statusCode: '409',
    statusMessage: 'Invalid mobile identifier',
    errorCode: 'MOBILE_NUMBER_ERROR'
  }
}

export function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}