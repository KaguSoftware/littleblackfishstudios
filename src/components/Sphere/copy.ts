import type { SphereCopy, SphereLocale } from './types';

export const SPHERE_COPY: Record<SphereLocale, SphereCopy> = {
  en: {
    kicker: 'Portfolio',
    title: 'Projects',
    all: 'All',
    filterLabel: 'Filter projects',
    stageLabel:
      'Our projects. Drag to look around the sphere, arrow keys to turn, Enter to open a screen, Escape to go back.',
    hintFine: [
      ['Drag', 'to look around'],
      ['Click', 'a screen'],
    ],
    hintTouch: [
      ['Drag', 'to look around'],
      ['Tap', 'a screen'],
    ],
    dragHint: 'Drag to move',
    open: 'OPEN',
    view: 'VIEW',
    back: 'BACK',
    openProject: 'Open project',
    close: 'Close and look around',
    prev: 'Previous project',
    next: 'Next project',
    map: 'Sphere map',
    mapLabel: 'Map of all screens. Click to jump.',
    loader: 'Entering the sphere',
    allProjects: 'All projects',
    kindVideo: 'Video',
    kindGallery: 'Gallery',
    kindImage: 'Project',
    inView: 'IN VIEW',
  },
  fa: {
    kicker: 'نمونه کارها',
    title: 'پروژه‌ها',
    all: 'همه',
    filterLabel: 'فیلتر پروژه‌ها',
    stageLabel:
      'پروژه‌های استودیو. برای نگاه کردن به اطراف بکشید، با کلیدهای جهت بچرخید، برای باز کردن یک صفحه Enter و برای بازگشت Escape را بزنید.',
    hintFine: [
      ['بکشید', 'تا اطراف را ببینید'],
      ['کلیک', 'روی یک صفحه'],
    ],
    hintTouch: [
      ['بکشید', 'تا اطراف را ببینید'],
      ['لمس', 'یک صفحه'],
    ],
    dragHint: 'برای حرکت بکشید',
    open: 'باز کن',
    view: 'مشاهده',
    back: 'بازگشت',
    openProject: 'مشاهده پروژه',
    close: 'بستن',
    prev: 'پروژه قبلی',
    next: 'پروژه بعدی',
    map: 'نقشه کره',
    mapLabel: 'نقشه همه صفحه‌ها. برای رفتن به یک نقطه کلیک کنید.',
    loader: 'در حال ورود به کره',
    allProjects: 'همه پروژه‌ها',
    kindVideo: 'ویدیو',
    kindGallery: 'گالری',
    kindImage: 'پروژه',
    inView: 'در دید',
  },
};

/** What the globe on the home page says, per locale. */
export interface GlobeCopy {
  kicker: string;
  title: string;
  cta: string;
  hint: string;
  label: string;
}

export const GLOBE_COPY: Record<SphereLocale, GlobeCopy> = {
  en: {
    kicker: 'Selected work',
    title: 'Step into our world',
    cta: 'View projects',
    hint: 'Drag to spin',
    label: 'A globe of our projects. Drag to spin it. Use the View projects button to go inside.',
  },
  fa: {
    kicker: 'نمونه کارها',
    title: 'به جهان ما قدم بگذارید',
    cta: 'مشاهده پروژه‌ها',
    hint: 'برای چرخاندن بکشید',
    label: 'کره‌ای از پروژه‌های ما. برای چرخاندن بکشید و با دکمه‌ی مشاهده پروژه‌ها وارد آن شوید.',
  },
};
