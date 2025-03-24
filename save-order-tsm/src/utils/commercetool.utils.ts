export function isCommercetoolsError(error: any): error is { body: { errors: Array<{ code: string }> } } {
    return error?.body?.errors instanceof Array;
}