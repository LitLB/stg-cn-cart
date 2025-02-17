export function convertToThailandMobile(mobile: string): string {
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