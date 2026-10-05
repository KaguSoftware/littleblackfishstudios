'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';

const content = {
  en: {
    header: "We Build Worlds.",
    mark: "Little Black Fish",
    acts: [
      {
        title: "Little Black Fish",
        text: "Little Black Fish is an independent creative studio for storytelling, image and world-building. A place to shape stories, characters and worlds that have their own language and identity. We come from narrative, image, performance and imagination. Cinema, animation, photography, painting, performance and new technologies are not destinations for us; they are media through which an idea can take shape. We do not choose the form in advance. Every world finds its own language and tools."
      },
      {
        title: "Worlds you can enter",
        text: "Years of experience across different fields of art and storytelling have brought us, today, to a shared point: building worlds that you can enter, believe in and remember. Every project begins with a simple idea. The name Little Black Fish comes from one. A little black fish decides to leave the familiar path. It does not know what waits at the end of the road, and it does not wait to be ready before setting out. It moves with what it has, to see what it has not yet seen and to reach a place it does not yet know. Our way of working is close to this idea. We are not after repeating familiar forms. Every project is an opportunity to discover its own logic, language and identity, from narrative and character to image, motion, space and the tools needed to build its world."
      },
      {
        title: "Slightly farther than familiar waters",
        text: "Technology is a tool for us, not an identity. Tools change; what remains is the vision, the story and the world that has been built. A project may begin with an image, a character, a text or even a question. What matters to us is that its starting point has the capacity to keep growing, into a larger world with its own logic, memory and identity, one that can go beyond its origin. Shahnameh: Land of Crown and Legend is one of these experiences: a contemporary encounter with a world that existed centuries before us, and a renewed attempt to find a fresh language for seeing and experiencing it. Little Black Fish was created to make something that does not yet have a ready-made example."
      }
    ]
  },
  fa: {
    header: "ما جهان می‌سازیم.",
    mark: "ماهی سیاه کوچولو",
    acts: [
      {
        title: "ماهی سیاه کوچولو",
        text: "ماهی سیاه کوچولو یک استودیوی خلاقهٔ مستقل برای روایت، تصویر و جهان‌سازی است؛ جایی برای شکل‌دادن به داستان‌ها، شخصیت‌ها و جهان‌هایی که زبان و هویت خودشان را دارند. ما از روایت، تصویر، نمایش و خیال می‌آییم. سینما، انیمیشن، عکاسی، نقاشی، اجرا و فناوری‌های تازه برای ما مقصد نیستند؛ مدیوم‌هایی هستند که یک ایده می‌تواند از طریق آن‌ها شکل بگیرد. فرم را از پیش انتخاب نمی‌کنیم. هر جهان، زبان و ابزار خودش را پیدا می‌کند."
      },
      {
        title: "جهان‌هایی که بتوان واردشان شد",
        text: "سال‌ها تجربه در حوزه‌های مختلف هنر و روایت، امروز در ماهی سیاه کوچولو به یک نقطهٔ مشترک رسیده است: ساختن جهان‌هایی که بتوان واردشان شد، باورشان کرد و به خاطر سپرد. هر پروژه از یک ایدهٔ ساده آغاز می‌شود. نام ماهی سیاه کوچولو از همین ایده می‌آید. ماهی سیاه کوچولو تصمیم می‌گیرد از مسیر آشنا بیرون برود. نمی‌داند در انتهای راه چه چیزی منتظر اوست و برای رفتن هم منتظر کامل‌شدن نمی‌ماند. با همان چیزی که دارد حرکت می‌کند؛ برای دیدن چیزی که پیش از آن ندیده و رسیدن به جایی که هنوز نمی‌شناسد. شیوهٔ کار ما به این ایده نزدیک است. ما به دنبال تکرار فرم‌های آشنا نیستیم. هر پروژه برای ما فرصتی است برای پیدا کردن منطق، زبان و هویت خودش؛ از روایت و شخصیت تا تصویر، حرکت، فضا و ابزارهایی که برای ساخت آن جهان لازم است."
      },
      {
        title: "برای رفتن کمی دورتر از آب‌های آشنا",
        text: "فناوری برای ما ابزار است، نه هویت. ابزارها تغییر می‌کنند؛ چیزی که باقی می‌ماند نگاه، روایت و جهانی است که ساخته شده. یک پروژه ممکن است با یک تصویر، یک شخصیت، یک متن یا حتی یک سؤال شروع شود. چیزی که برای ما اهمیت دارد ظرفیت نقطهٔ آغازش برای ادامه پیدا کردن و تبدیل‌شدن به جهانی بزرگ‌تر است؛ جهانی با منطق، حافظه و هویت خودش که بتواند فراتر از شاهنامه: سرزمین تاج و افسانه یکی از این تجربه‌هاست؛ مواجههٔ معاصر با جهانی که قرن‌ها پیش از ما وجود داشته و تلاش دوبارهٔ آن برای پیدا کردن زبانی تازه برای دیدن و تجربه‌کردن. ماهی سیاه کوچولو برای ساختن چیزی به وجود آمده که هنوز نمونهٔ آماده‌ای برایش وجود ندارد."
      }
    ]
  }
};

const WordByWordHeader = ({ text }: { text: string }) => {
  const words = text.split(' ');

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 },
    },
  };

  const child = {
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        damping: 20,
        stiffness: 100,
      },
    },
  };

  return (
    <motion.h1
      className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-tight md:leading-none text-zinc-100"
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-100px" }}
    >
      {words.map((word, index) => (
        <React.Fragment key={index}>
          <motion.span variants={child} className="inline-block">
            {word}
          </motion.span>
          {' '}
        </React.Fragment>
      ))}
    </motion.h1>
  );
};

const ProjectedText = ({ text }: { text: string }) => {
  const words = text.split(' ');

  const container = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.04 },
    },
  };

  const child = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: [0.2, 0.65, 0.3, 0.9] as [number, number, number, number],
      },
    },
  };

  return (
    <motion.p
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-20%" }}
      className="text-2xl md:text-4xl lg:text-5xl font-light leading-relaxed md:leading-snug text-zinc-300"
    >
      {words.map((word, index) => (
        <React.Fragment key={index}>
          <motion.span variants={child} className="inline-block">
            {word}
          </motion.span>
          {' '}
        </React.Fragment>
      ))}
    </motion.p>
  );
};

export default function AboutPage() {
  const params = useParams();
  const locale = (params?.locale as 'en' | 'fa') || 'en';
  const isRtl = locale === 'fa';
  const data = content[locale] || content['en'];

  return (
    <div
      className="min-h-screen bg-zinc-950 text-zinc-100 overflow-hidden relative selection:bg-zinc-800 selection:text-white"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Massive Background Typography */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 0.04, scale: 1 }}
          transition={{ duration: 3, ease: "easeOut" }}
          className="text-[12vw] md:text-[10vw] font-black text-white select-none leading-none tracking-tighter whitespace-nowrap"
        >
          {data.mark}
        </motion.div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-40 pb-40">

        {/* Header Section */}
        <section className="min-h-[70vh] flex flex-col justify-center max-w-5xl">
          <WordByWordHeader text={data.header} />
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 1, duration: 1, ease: "easeInOut" }}
            className={`h-[2px] w-32 bg-zinc-500 mt-12 ${isRtl ? 'origin-right' : 'origin-left'}`}
          />
        </section>

        {/* Narrative Acts */}
        <div className="space-y-40 md:space-y-64 mt-20">
          {data.acts.map((act, index) => {
            const isEven = index % 2 === 0;
            return (
              <div
                key={index}
                className={`flex flex-col md:flex-row gap-8 md:gap-24 items-start ${
                  !isEven ? 'md:flex-row-reverse' : ''
                }`}
              >
                {/* Act Indicator */}
                <div className="w-full md:w-1/4 shrink-0 mt-2 md:mt-4">
                  <div className="md:sticky md:top-40">
                    <motion.div
                      initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-20%" }}
                      transition={{ duration: 0.6 }}
                    >
                      <span className="text-zinc-500 font-bold tracking-widest uppercase text-sm md:text-base block mb-4">
                        {act.title}
                      </span>
                      <div className="h-px w-full bg-zinc-800" />
                    </motion.div>
                  </div>
                </div>

                {/* Act Content */}
                <div className="w-full md:w-3/4">
                  <ProjectedText text={act.text} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
