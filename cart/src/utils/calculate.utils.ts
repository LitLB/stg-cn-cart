export const calculateAge = (birthdate: string): number => {
    // const birthdate = '1990-01-01'
    const day = birthdate.substring(0, 2)
    const month = birthdate.substring(2, 4)
    const year = birthdate.substring(4, 8)

    const date = new Date(`${year}-${month}-${day}`);
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
    return age;
}