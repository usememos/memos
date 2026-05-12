export type PlaceholderVariant = "empty" | "loading" | "noResults" | "notFound";

export type MotionStyle = "bob" | "flutter" | "none";

export interface AsciiPiece {
  id: string;
  variant: PlaceholderVariant;
  ascii: string;
  credit: string;
  motion: MotionStyle;
}

export const ASCII_POOL: AsciiPiece[] = [
  {
    id: "jgs-crested-parrot",
    variant: "empty",
    credit: "jgs · 4/97",
    motion: "bob",
    ascii: `       .---.
      /   6_6
      \\_  (__\\
      //   \\\\
     ((     ))
=====""===""=====
        |||
         |`,
  },
  {
    id: "jgs-hummingbird-sm",
    variant: "loading",
    credit: "jgs · 7/98",
    motion: "flutter",
    ascii: `           ,   _
          { \\/\`o;====-
     .----'-/\`-/
      \`'-..-| /
            /\\/\\
            \`--\``,
  },
  {
    id: "jgs-wide-eyed-owl",
    variant: "noResults",
    credit: "jgs · 2/01",
    motion: "bob",
    ascii: `      __       __
      \\ \`-'"'-\` /
      / \\_   _/ \\
      |  d\\_/b  |
     .'\\   V   /'.
    /   '-...-'   \\
    | /         \\ |
    \\/\\         /\\/
    ==(||)---(||)==`,
  },
  {
    id: "jgs-bird-flown-away",
    variant: "notFound",
    credit: "jgs · 7/96",
    motion: "flutter",
    ascii: `                      ___
                  _,-' ______
                .'  .-'  ____7
               /   /   ___7
             _|   /  ___7
           >(')\\ | ___7
             \\\\/     \\_______
             '        _======>
             \`'----\\\\\``,
  },
];

export function pickPiece(variant: PlaceholderVariant): AsciiPiece {
  const matches = ASCII_POOL.filter((p) => p.variant === variant);
  if (matches.length === 0) {
    throw new Error(`No ASCII piece registered for variant "${variant}"`);
  }
  return matches[Math.floor(Math.random() * matches.length)];
}
