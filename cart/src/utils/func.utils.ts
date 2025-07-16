export function formatDateFromString(input: string): string { //convert date ddmmyyyyy to dd/mm/yyyyy
  if (input.length !== 8) return input;
  const day = input.slice(0, 2);
  const month = input.slice(2, 4);
  const year = input.slice(4);
  return `${day}/${month}/${year}`;
}