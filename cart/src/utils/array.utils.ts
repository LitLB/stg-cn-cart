export const removeDuplicateStringArray = (arr: string[]): string[] => {
    return arr.filter((item,
        index) => arr.indexOf(item) === index);
}

interface Item {
    code: string;
    amount: number;
}
// for discount and other payment that have data structure like { code: string, amount: number }
export const areArraysEqual = (arr1: Item[], arr2: Item[]): boolean => {

    arr1.sort((a, b) => a.code.localeCompare(b.code));
    arr2.sort((a, b) => a.code.localeCompare(b.code));

    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
        return false;
    }

    if (arr1.length !== arr2.length) {
        return false;
    }

    for (let i = 0; i < arr1.length; i++) {
        const item1 = arr1[i];
        const item2 = arr2[i];

        if (!item1 || typeof item1 !== 'object' || !item2 || typeof item2 !== 'object') {
            return false;
        }

        if (item1.code !== item2.code || item1.amount !== item2.amount) {
            return false; 
        }
    }

    return true;
}

