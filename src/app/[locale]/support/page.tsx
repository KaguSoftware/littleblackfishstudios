import React from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowUpLeft, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { SUPPORT_PAGE, SUPPORT_URL, SUPPORT_URL_IRAN } from '@/data/support';

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const copy = locale === 'fa' ? SUPPORT_PAGE.fa : SUPPORT_PAGE.en;

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
  };
}

interface PayOption {
  href: string;
  heading: string;
  label: string;
  caption: string;
}

function PayButtons({ options, Arrow }: { options: PayOption[]; Arrow: LucideIcon }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 desk:grid-cols-1 xl:grid-cols-2">
      {options.map((o) => (
        <div key={o.href} className="flex flex-col gap-2">
          <span className="ps-5 text-[11px] font-bold tracking-[0.2em] text-zinc-500 uppercase rtl:text-xs rtl:font-normal rtl:tracking-normal">
            {o.heading}
          </span>
          <a
            href={o.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex h-16 items-center justify-between gap-3 overflow-hidden rounded-full bg-white/[0.03] ps-5 pe-2 ring-1 ring-white/15 transition-shadow ring-inset hover:ring-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none active:scale-[0.99]"
          >
            {/* Blue fill sweeping in from the start edge, like the menu's layers */}
            <span
              aria-hidden
              className="absolute inset-0 origin-left scale-x-0 bg-blue-600 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100 rtl:origin-right"
            />
            <span className="relative flex min-w-0 flex-col items-start gap-0.5 text-start">
              <span className="truncate text-sm font-black tracking-[0.12em] text-white uppercase rtl:text-base rtl:font-normal rtl:tracking-normal">
                {o.label}
              </span>
              <span className="truncate text-xs text-zinc-400 transition-colors group-hover:text-white/80 rtl:font-sans">
                {o.caption}
              </span>
            </span>
            <span className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white transition-colors group-hover:bg-white group-hover:text-blue-600">
              <Arrow className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
            </span>
          </a>
        </div>
      ))}
    </div>
  );
}

export default async function SupportPage({ params }: Props) {
  const { locale } = await params;
  if (!['en', 'fa'].includes(locale)) notFound();

  const isRtl = locale === 'fa';
  const copy = isRtl ? SUPPORT_PAGE.fa : SUPPORT_PAGE.en;
  const Arrow = isRtl ? ArrowUpLeft : ArrowUpRight;
  const num = (n: number) => n.toLocaleString(isRtl ? 'fa-IR' : 'en-US');

  const worldwide = { href: SUPPORT_URL, ...copy.worldwide };
  const iran = { href: SUPPORT_URL_IRAN, ...copy.iran };
  const options = isRtl ? [iran, worldwide] : [worldwide, iran];

  const { done, total } = copy.progress;
  const [intro, ...rest] = copy.sections;

  const section = (s: (typeof copy.sections)[number], i: number) => (
    <section key={s.heading} className="flex flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs font-bold text-blue-500">{num(i + 1).padStart(2, isRtl ? '۰' : '0')}</span>
        <h2 className="text-lg font-black tracking-tight text-white desk:text-base xl:text-lg rtl:font-normal rtl:tracking-normal">
          {s.heading}
        </h2>
      </div>
      {s.body.map((p) => (
        <p
          key={p.slice(0, 24)}
          className="text-[15px] leading-relaxed text-zinc-300 desk:text-[13px] desk:leading-[1.6] 2xl:text-sm rtl:font-sans rtl:leading-loose rtl:desk:leading-[1.8]"
        >
          {p}
        </p>
      ))}
    </section>
  );

  return (
    <div className="relative overflow-hidden bg-black desk:h-dvh" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Soft blue light behind the content */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-40 left-1/2 size-[28rem] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[120px] desk:top-1/2 desk:left-1/4 desk:size-[40rem] desk:-translate-y-1/2 rtl:desk:left-3/4"
      />

      <div className="relative container mx-auto flex flex-col gap-14 px-5 pt-32 pb-16 sm:px-6 desk:grid desk:h-full desk:grid-cols-12 desk:items-center desk:gap-12 desk:pt-24 desk:pb-6 xl:gap-20">
        {/* Hero + payment */}
        <div className="flex flex-col gap-8 desk:col-span-5 desk:gap-6 xl:gap-7">
          <div>
            <div className="mb-5 flex items-center gap-3 desk:mb-4">
              <span className="h-px w-8 bg-blue-500" />
              <span className="text-xs font-bold tracking-[0.3em] text-blue-500 uppercase rtl:text-sm rtl:font-normal rtl:tracking-normal">
                {copy.eyebrow}
              </span>
            </div>
            <h1 className="text-[2.75rem] leading-[0.95] font-black tracking-tighter text-white uppercase sm:text-6xl desk:text-5xl xl:text-6xl rtl:leading-[1.25] rtl:font-normal rtl:tracking-normal">
              {copy.title}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-zinc-400 desk:mt-4 desk:text-sm xl:text-base rtl:font-sans rtl:leading-loose">
              {copy.lede}
            </p>
          </div>

          {/* Progress: episodes released out of the full run */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black tracking-tighter text-white tabular-nums desk:text-3xl rtl:font-normal">
                {num(done)}
                <span className="text-zinc-600"> / {num(total)}</span>
              </span>
              <span className="text-xs text-zinc-500 rtl:font-sans">{copy.progress.label}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-black tracking-[0.2em] text-white uppercase rtl:text-base rtl:font-normal rtl:tracking-normal">
              {copy.chooseHeading}
            </h2>
            <PayButtons options={options} Arrow={Arrow} />
          </div>

          <p className="hidden border-s-2 border-blue-600 ps-4 text-sm leading-relaxed font-bold text-white desk:block rtl:font-normal">
            {copy.closing}
          </p>
        </div>

        {/* Story */}
        <div className="flex flex-col gap-10 desk:col-span-7 desk:gap-6 xl:gap-7">
          {section(intro, 0)}
          <div className="grid gap-10 border-t border-white/10 pt-10 desk:grid-cols-2 desk:gap-8 desk:pt-6 xl:gap-10 xl:pt-7">
            {rest.map((s, i) => section(s, i + 1))}
          </div>
          <p className="border-t border-white/10 pt-6 text-xs leading-relaxed text-zinc-500 desk:pt-5 desk:text-[11px] 2xl:text-xs rtl:font-sans rtl:leading-loose">
            {copy.disclaimer}
          </p>

          {/* Mobile close: pull quote + buttons again, so nobody scrolls back up */}
          <div className="flex flex-col gap-8 desk:hidden">
            <p className="border-s-2 border-blue-600 ps-4 text-xl leading-snug font-black text-white rtl:leading-relaxed rtl:font-normal">
              {copy.closing}
            </p>
            <PayButtons options={options} Arrow={Arrow} />
          </div>
        </div>
      </div>
    </div>
  );
}
