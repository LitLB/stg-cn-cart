export const removeDuplicateStringArray = (arr: string[]): string[] => {
    return arr.filter((item,
        index) => arr.indexOf(item) === index);
}