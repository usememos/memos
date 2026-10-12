type InkScene = "memo" | "search" | "inbox";

interface InkIllustrationProps {
  scene: InkScene;
}

// A quiet line connects the three empty states; only the object at its center changes.
const InkIllustration = ({ scene }: InkIllustrationProps) => (
  <svg
    viewBox="0 0 560 280"
    className="h-auto w-full"
    aria-hidden="true"
    focusable="false"
    data-testid="placeholder-illustration"
    data-scene={scene}
  >
    <path
      d="M54 218 C101 207 119 220 166 230 C212 242 271 229 332 231 C407 233 446 207 510 216"
      fill="none"
      stroke="#ded8ca"
      strokeWidth="1.5"
    />
    <path
      d="M109 80 C133 54 182 55 205 80 C218 94 214 124 201 143 C178 173 131 165 111 141 C90 117 88 94 109 80Z"
      fill="#d9b7aa"
      opacity=".55"
    />
    <path
      d="M341 45 C365 32 406 49 417 73 C434 106 404 125 384 149 C364 172 335 157 322 129 C306 94 313 59 341 45Z"
      fill="#b9c7aa"
      opacity=".73"
    />
    <path
      d="M68 189 C95 160 136 170 157 196 C180 226 196 237 222 225"
      fill="none"
      stroke="#738c9c"
      strokeWidth="23"
      opacity=".27"
      strokeLinecap="round"
    />
    <path d="M432 168 C451 150 470 149 494 160" fill="none" stroke="#d7ad6f" strokeWidth="25" opacity=".42" strokeLinecap="round" />
    <path
      d="M83 121 C127 101 157 121 175 157 C193 195 222 214 260 194 C299 174 267 115 297 94 C327 71 377 97 368 136 C358 178 410 196 473 150"
      fill="none"
      stroke="#2e3435"
      strokeWidth="2.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M132 47 L136 66 M121 57 L148 55 M442 68 L447 88 M433 79 L456 77" stroke="#a77955" strokeWidth="2" strokeLinecap="round" />
    <circle cx="92" cy="88" r="3" fill="#2e3435" />
    <circle cx="458" cy="119" r="4" fill="#bb785c" />
    <path d="M467 104 Q479 90 493 95 Q481 108 467 104Z" fill="#b7c5a6" stroke="#2e3435" strokeWidth="1.5" />

    {scene === "memo" && (
      <>
        <path
          d="M215 57 Q264 50 307 62 L311 181 Q261 171 211 183Z"
          fill="#f7f0df"
          stroke="#2e3435"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M260 59 Q257 121 260 174" fill="none" stroke="#a29a8c" strokeWidth="1.5" />
        <path d="M234 90 Q246 85 252 95 M272 97 Q280 91 288 96" fill="none" stroke="#c59b82" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M241 148 C250 135 268 132 279 140" fill="none" stroke="#bf7759" strokeWidth="4" strokeLinecap="round" />
        <circle cx="277" cy="139" r="4" fill="#bf7759" />
      </>
    )}
    {scene === "search" && (
      <>
        <path
          d="M227 64 C255 53 293 62 310 91 C329 126 305 171 270 177 C236 183 204 154 205 121 C206 94 213 77 227 64Z"
          fill="#f7f0df"
          stroke="#2e3435"
          strokeWidth="2.5"
        />
        <path
          d="M229 105 C244 91 260 91 276 106 C288 117 290 134 280 144"
          fill="none"
          stroke="#bd7e5e"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d="M282 150 Q292 162 309 158" fill="none" stroke="#bd7e5e" strokeWidth="2" strokeLinecap="round" />
        <circle cx="270" cy="130" r="4" fill="#2e3435" />
        <path d="M307 162 Q326 179 343 191" fill="none" stroke="#2e3435" strokeWidth="5" strokeLinecap="round" />
      </>
    )}
    {scene === "inbox" && (
      <>
        <path
          d="M218 94 Q264 53 310 94 L312 177 Q266 195 217 176Z"
          fill="#f7f0df"
          stroke="#2e3435"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path d="M218 94 Q257 136 312 94 M218 176 Q254 140 264 145 Q276 142 312 177" fill="none" stroke="#2e3435" strokeWidth="2" />
        <path d="M247 105 Q255 89 264 96 Q274 87 282 105" fill="none" stroke="#bd7e5e" strokeWidth="2.5" />
        <circle cx="264" cy="146" r="7" fill="#bc8a74" />
      </>
    )}
    <path d="M154 213 Q164 198 177 206 M389 217 Q402 204 416 210" fill="none" stroke="#708777" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default InkIllustration;
export type { InkScene };
