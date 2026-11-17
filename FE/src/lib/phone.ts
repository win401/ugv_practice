/**
 * 입력한 글자에서 숫자만 남겨 010-1234-5678 형식으로 만든다. 하이픈 없이 쳐도 알아서 넣는다.
 * 서울 번호(02)는 02-123-4567, 02-1234-5678 로 만든다.
 */
export function formatPhone(input: string) {
  const seoul = input.replace(/\D/g, "").startsWith("02");
  const digits = input.replace(/\D/g, "").slice(0, seoul ? 10 : 11);
  const head = digits.slice(0, seoul ? 2 : 3);
  const rest = digits.slice(head.length);
  if (!rest) return head;
  if (rest.length <= 3) return `${head}-${rest}`;
  // 뒷자리는 항상 네 자리다. 가운데는 세 자리 또는 네 자리.
  const middle = rest.length <= 7 ? 3 : 4;
  return `${head}-${rest.slice(0, middle)}-${rest.slice(middle)}`;
}

/** 다 입력한 전화번호인지. 예: 010-1234-5678, 02-123-4567 */
export function isPhone(value: string) {
  return /^0\d{1,2}-\d{3,4}-\d{4}$/.test(value);
}
