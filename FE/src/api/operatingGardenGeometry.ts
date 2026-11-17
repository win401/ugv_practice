import type { GardenGeometry } from "./types";

/**
 * The first demo used a different aerial photo. Recognize only its three exact
 * seed outlines, and return geometry authored for the current 1536 × 1024 scene.
 * Identity, customer, device, history and custom outlines are left untouched.
 * This is an API response adapter: it never rewrites the saved demo database.
 */
const legacyOutlines = {
  rose: "M815 440Q815 425 800 425L660 410Q650 410 640 416L575 465Q565 472 565 485L570 640Q570 655 585 655L675 655Q685 655 692 648L810 535Q815 530 815 520Z",
  flowers:
    "M265 215L150 222Q138 224 140 238L155 390L200 535Q210 545 225 535L280 440Q288 425 284 410L280 230Q280 215 265 215Z",
  lawn: "M415 115Q415 105 400 102L230 88Q215 88 218 105Q225 140 238 165Q280 195 284 240L284 320L310 330Q340 250 400 215Q430 195 425 170Z",
};

const currentGeometry: Record<keyof typeof legacyOutlines, GardenGeometry> = {
  rose: {
    shape:
      "M780 286 C825 267 893 270 929 299 C951 321 962 365 957 403 C951 442 924 465 887 476 C844 481 797 471 768 447 C742 421 735 384 743 347 C749 319 760 299 780 286 Z",
    label: [785, 281],
    route: [
      [743, 458],
      [751, 430],
      [745, 407],
      [741, 383],
      [745, 345],
      [758, 316],
      [780, 289],
      [858, 283],
      [914, 284],
      [945, 304],
      [949, 338],
      [956, 393],
      [956, 455],
    ],
  },
  flowers: {
    shape:
      "M553 322 C657 322 747 391 761 491 C776 594 712 691 609 719 C507 747 405 695 365 602 C320 499 353 394 450 341 C482 325 519 320 553 322 Z",
    label: [420, 320],
    route: [
      [472, 737],
      [516, 624],
      [558, 521],
      [447, 487],
      [350, 459],
      [394, 472],
      [558, 521],
      [686, 473],
      [743, 458],
    ],
  },
  lawn: {
    shape:
      "M281 118 L448 81 L680 70 L905 107 L1086 151 L1061 201 L796 225 L580 247 L330 288 L206 285 L224 202 Z",
    label: [580, 174],
    route: [
      [350, 321],
      [450, 304],
      [559, 290],
      [655, 270],
      [780, 253],
      [900, 241],
      [1050, 225],
    ],
  },
};

export function normalizeOperatingGarden<T extends GardenGeometry>(
  garden: T,
): T {
  const kind = (
    Object.keys(legacyOutlines) as (keyof typeof legacyOutlines)[]
  ).find((key) => garden.shape === legacyOutlines[key]);
  if (!kind) return garden;
  const geometry = currentGeometry[kind];
  return {
    ...garden,
    shape: geometry.shape,
    label: [...geometry.label],
    route: geometry.route.map((point) => [...point]),
  };
}
