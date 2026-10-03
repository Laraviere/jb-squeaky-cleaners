import type { CSSProperties } from "react";

const paths = {
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  house: <><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8" /></>,
  building: <><path d="M4 21V3h12v18M16 9h4v12M2 21h20M8 7h4M8 11h4M8 15h4M9 21v-3h2v3" /></>,
  sparkle: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4M18 4h4" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  phone: <><path d="m7 3-4 2c0 9 7 16 16 16l2-4-5-3-2 2a12 12 0 0 1-6-6l2-2-3-5Z" /></>,
};

export function Icon({ name, style }: { name: keyof typeof paths; style?: CSSProperties }) {
  return <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={style}>{paths[name]}</svg>;
}
