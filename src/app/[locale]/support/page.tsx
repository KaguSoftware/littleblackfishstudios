import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import supportBg from '@/assets/support-bg.webp';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowUpLeft, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { SUPPORT_PAGE, SUPPORT_URL, SUPPORT_URL_IRAN, parseSupportBody, type SupportSection } from '@/data/support';
import { getSupportProjects } from '@/lib/queries/public';
import type { Project } from '@/lib/types';

export const revalidate = 3600;

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ project?: string | string[] }>;
}

/** The project picked with ?project=slug, else the first supportable one. */
async function resolveProject(searchParams: Props['searchParams']) {
  const [projects, { project }] = await Promise.all([getSupportProjects(), searchParams]);
  const slug = Array.isArray(project) ? project[0] : project;
  return { projects, selected: projects.find((p) => p.slug === slug) ?? projects[0] ?? null };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { locale } = await params;
  const isRtl = locale === 'fa';
  const copy = isRtl ? SUPPORT_PAGE.fa : SUPPORT_PAGE.en;
  const { selected } = await resolveProject(searchParams);
  if (!selected) return { title: copy.metaTitle, description: copy.metaDescription };

  const title = (isRtl ? selected.support_title_fa : selected.support_title_en) ?? copy.metaTitle;
  const intro = isRtl ? selected.support_intro_fa : selected.support_intro_en;
  return {
    title: `${title} | ${isRtl ? 'استودیو ماهی سیاه کوچولو' : 'Little Black Fish Studios'}`,
    description: intro ?? copy.metaDescription,
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

/** Project switcher: plain links, so each project has its own shareable URL. */
function ProjectPicker({ projects, selected, locale, isRtl }: { projects: Project[]; selected: Project; locale: string; isRtl: boolean }) {
  return (
    <nav className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {projects.map((p) => {
        const active = p.id === selected.id;
        return (
          <Link
            key={p.id}
            href={`/${locale}/support?project=${p.slug}`}
            scroll={false}
            aria-current={active ? 'page' : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold whitespace-nowrap ring-1 transition-colors ring-inset rtl:text-sm rtl:font-normal ${
              active
                ? 'bg-blue-600 text-white ring-blue-600'
                : 'bg-white/[0.03] text-zinc-400 ring-white/15 hover:text-white hover:ring-blue-500'
            }`}
          >
            {isRtl ? p.title_fa : p.title_en}
          </Link>
        );
      })}
    </nav>
  );
}

export default async function SupportPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!['en', 'fa'].includes(locale)) notFound();

  const isRtl = locale === 'fa';
  const copy = isRtl ? SUPPORT_PAGE.fa : SUPPORT_PAGE.en;
  const Arrow = isRtl ? ArrowUpLeft : ArrowUpRight;
  const num = (n: number) => n.toLocaleString(isRtl ? 'fa-IR' : 'en-US');

  const worldwide = { href: SUPPORT_URL, ...copy.worldwide };
  const iran = { href: SUPPORT_URL_IRAN, ...copy.iran };
  const options = isRtl ? [iran, worldwide] : [worldwide, iran];

  const { projects, selected } = await resolveProject(searchParams);

  const pick = (en?: string | null, fa?: string | null) => (isRtl ? fa : en) || null;
  const projectTitle = selected ? pick(selected.title_en, selected.title_fa) : null;
  const title = (selected && pick(selected.support_title_en, selected.support_title_fa)) ?? projectTitle ?? copy.studioTitle;
  const intro = selected ? pick(selected.support_intro_en, selected.support_intro_fa) : copy.studioIntro;
  const closing = selected ? pick(selected.support_closing_en, selected.support_closing_fa) : null;
  const sections = selected ? parseSupportBody(pick(selected.support_body_en, selected.support_body_fa)) : [];
  const done = selected?.support_episodes_done ?? null;
  const total = selected?.support_episodes_total ?? null;
  const showProgress = done != null && total != null && total > 0;
  const [first, ...rest] = sections;

  const section = (s: SupportSection, i: number) => (
    <section key={`${i}-${s.heading}`} className="flex flex-col gap-3">
      {s.heading && (
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-xs font-bold text-blue-500">{num(i + 1).padStart(2, isRtl ? '۰' : '0')}</span>
          <h2 className="text-lg font-black tracking-tight text-white desk:text-base xl:text-lg rtl:font-normal rtl:tracking-normal">
            {s.heading}
          </h2>
        </div>
      )}
      {s.paragraphs.map((p, j) => (
        <p
          key={j}
          className="text-[15px] leading-relaxed text-zinc-300 desk:text-[13px] desk:leading-[1.6] 2xl:text-sm rtl:font-sans rtl:leading-loose rtl:desk:leading-[1.8] short:text-xs short:leading-normal rtl:short:leading-relaxed"
        >
          {p}
        </p>
      ))}
    </section>
  );

  return (
    <div className="relative overflow-hidden bg-black desk:h-dvh" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Background photo: first screen on mobile (fading into black), full page on desktop */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-svh desk:h-full">
        <Image src={supportBg} alt="" fill priority placeholder="blur" sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-black/70" />
        <div className="absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black desk:bg-linear-to-r desk:from-black/80 desk:via-black/20 desk:to-black/70 rtl:desk:bg-linear-to-l" />
      </div>

      <div
        className={`relative container mx-auto flex flex-col gap-14 px-5 pt-32 pb-16 sm:px-6 desk:h-full desk:pt-[5.5rem] desk:pb-5 ${
          sections.length
            ? 'desk:grid desk:grid-cols-12 desk:grid-rows-1 desk:items-center desk:gap-12 xl:gap-20'
            : 'desk:mx-auto desk:max-w-xl desk:justify-center'
        }`}
      >
        {/* Hero + payment */}
        <div className="flex flex-col gap-8 desk:col-span-5 desk:max-h-full desk:gap-5 desk:overflow-y-auto desk:[scrollbar-width:none] xl:gap-5 2xl:gap-7 short:gap-4">
          <div>
            <div className="mb-5 flex flex-col gap-4 desk:mb-4 desk:flex-row desk:flex-wrap desk:items-center desk:gap-x-5 desk:gap-y-3">
              <div className="flex shrink-0 items-center gap-3">
                <span className="h-px w-8 bg-blue-500" />
                <span className="text-xs font-bold tracking-[0.3em] text-blue-500 uppercase rtl:text-sm rtl:font-normal rtl:tracking-normal">
                  {copy.eyebrow}
                </span>
              </div>
              {selected && projects.length > 1 && (
                <ProjectPicker projects={projects} selected={selected} locale={locale} isRtl={isRtl} />
              )}
            </div>
            <h1 className="text-[2.75rem] leading-[0.95] font-black tracking-tighter text-white uppercase sm:text-6xl desk:text-4xl xl:text-5xl 2xl:text-6xl short:text-3xl short:xl:text-3xl rtl:leading-[1.25] rtl:font-normal rtl:tracking-normal">
              {title}
            </h1>
            {intro && (
              <p className="mt-5 text-base leading-relaxed text-zinc-400 desk:mt-4 desk:text-sm xl:text-base rtl:font-sans rtl:leading-loose short:hidden">
                {intro}
              </p>
            )}
          </div>

          {/* Progress: episodes released out of the full run */}
          {showProgress && (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black tracking-tighter text-white tabular-nums desk:text-3xl rtl:font-normal">
                  {num(done)}
                  <span className="text-zinc-600"> / {num(total)}</span>
                </span>
                <span className="text-xs text-zinc-500 rtl:font-sans">{copy.progressLabel}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.min(100, (done / total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-black tracking-[0.2em] text-white uppercase rtl:text-base rtl:font-normal rtl:tracking-normal">
              {copy.chooseHeading}
            </h2>
            <PayButtons options={options} Arrow={Arrow} />
          </div>

          {closing && (
            <p className="hidden border-s-2 border-blue-600 ps-4 text-sm leading-relaxed font-bold text-white desk:block rtl:font-normal">
              {closing}
            </p>
          )}
        </div>

        {/* Story. Scrolls inside its column on desktop if an admin writes more than fits. */}
        {sections.length > 0 && (
          <div className="flex flex-col gap-10 desk:col-span-7 desk:max-h-full desk:gap-6 desk:overflow-y-auto desk:[scrollbar-width:thin] xl:gap-7 short:gap-4">
            {section(first, 0)}
            {rest.length > 0 && (
              <div className="grid gap-10 border-t border-white/10 pt-10 desk:grid-cols-2 desk:gap-8 desk:pt-6 xl:gap-10 xl:pt-7 short:gap-5 short:pt-4">
                {rest.map((s, i) => section(s, i + 1))}
              </div>
            )}
            <p className="border-t border-white/10 pt-6 text-xs leading-relaxed text-zinc-500 desk:pt-5 desk:text-[11px] 2xl:text-xs rtl:font-sans rtl:leading-loose">
              {copy.disclaimer}
            </p>

            {/* Mobile close: pull quote + buttons again, so nobody scrolls back up */}
            <div className="flex flex-col gap-8 desk:hidden">
              {closing && (
                <p className="border-s-2 border-blue-600 ps-4 text-xl leading-snug font-black text-white rtl:leading-relaxed rtl:font-normal">
                  {closing}
                </p>
              )}
              <PayButtons options={options} Arrow={Arrow} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
