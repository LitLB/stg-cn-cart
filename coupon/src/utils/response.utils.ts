export const safelyParse = (input: string | object): object | string => {
    if (typeof input === 'object') {
        return input;
    }

    try {
        return JSON.parse(input);
    } catch (e) {
        return input;
    }
}