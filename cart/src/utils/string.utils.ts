// cart/src/utils/string.utils.ts

export function camelToTitleCase(str: string): string {
    const spacedStr = str.replace(/([a-z])([A-Z])/g, '$1 $2');
    return spacedStr.charAt(0).toUpperCase() + spacedStr.slice(1);
}

export function camelToUpperSnakeCase(str: string): string {
    return str.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase();
}