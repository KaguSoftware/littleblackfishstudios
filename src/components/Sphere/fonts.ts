import { Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';

// Bricolage Grotesque is a variable font, so no `weight` is passed: next/font then loads the
// whole 200-800 range from one file (only the `wght` axis; `opsz` and `wdth` stay off).
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bricolage',
});

const jetbrains = JetBrains_Mono({
  weight: ['400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

// Persian text uses Lalezar, which the root layout already provides as --font-lalezar.
/** Put on an ancestor of the sphere so `var(--font-bricolage)` and `var(--font-jetbrains)` resolve. */
export const sphereFontVars = `${bricolage.variable} ${jetbrains.variable}`;
