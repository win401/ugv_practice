import imageUrl from "../assets/suncheon-garden-detail-wide.webp";

/** The shared image frame for the garden illustration and mission editor. */
export const GARDEN_IMAGE = {
  url: imageUrl,
  width: 1536,
  height: 1024,
  // 그림 내용이 같으면 형식(PNG→WebP)만 바꿔도 개정 번호는 유지한다. 저장된 구역 편집본과의 대응이 이 값으로 정해진다.
  revision: "suncheon-wide-v2",
} as const;
