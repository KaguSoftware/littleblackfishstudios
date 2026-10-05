/**
 * Gumroad product URL ("pay what you want", so the supporter names their own amount).
 *
 * Use the custom permalink (/coffee), NOT the /l/<id> form: the latter 302-redirects
 * to /coffee and drops any query string.
 */
export const SUPPORT_URL = 'https://lbfstudios.gumroad.com/coffee';

/** tlcard charge page for supporters in Iran, who can't pay through Gumroad. */
export const SUPPORT_URL_IRAN = 'https://tlcard.ir/charge/7603/8565';

/**
 * Copy shared by every project on the support page. Each project's own title, intro,
 * main text, closing line and episode count live on the project row (admin panel).
 */
export const SUPPORT_PAGE = {
  en: {
    eyebrow: 'Support',
    progressLabel: 'episodes released so far',
    disclaimer:
      'Support is voluntary and no product or service is provided in return. It is not a purchase, an investment, ownership or commercial sponsorship. It is simply a way to stand behind the making of this project.',
    chooseHeading: 'Choose how to support',
    iran: { heading: 'Paying from inside Iran', label: 'Support in Rial', caption: 'Iranian bank card, desired amount' },
    worldwide: { heading: 'Paying from outside Iran', label: 'Support in Dollars', caption: 'Card, any amount' },
    projectCta: 'Support this project',
    // Shown when no project has the support page switched on
    studioTitle: 'Support the Studio',
    studioIntro: 'Independent cinema and animation, funded by the people who watch it.',
    metaTitle: 'Support | Little Black Fish Studios',
    metaDescription:
      'Support Little Black Fish Studios. Independent cinema and animation, funded by the people who watch it.',
  },
  fa: {
    eyebrow: 'حمایت',
    progressLabel: 'قسمت تا امروز منتشر شده',
    disclaimer:
      'این حمایت داوطلبانه است و در مقابل آن محصول یا خدماتی ارائه نمی‌شود. حمایت مالی به‌معنای خرید، سرمایه‌گذاری، مالکیت یا اسپانسرینگ تجاری نیست؛ فقط همراهی با ادامهٔ ساخت این پروژه است.',
    chooseHeading: 'انتخاب روش حمایت',
    iran: { heading: 'پرداخت از داخل ایران', label: 'حمایت ریالی', caption: 'کارت بانکی ایرانی، مبلغ دلخواه' },
    worldwide: { heading: 'پرداخت از خارج ایران', label: 'حمایت دلاری', caption: 'کارت بین‌المللی، مبلغ دلخواه' },
    projectCta: 'از این پروژه حمایت کنید',
    studioTitle: 'حمایت از استودیو',
    studioIntro: 'سینما و انیمیشن مستقل، با پشتیبانی کسانی که آن را می‌بینند.',
    metaTitle: 'حمایت | استودیو ماهی سیاه کوچولو',
    metaDescription:
      'از استودیو ماهی سیاه کوچولو حمایت کنید. سینما و انیمیشن مستقل، با پشتیبانی کسانی که آن را می‌بینند.',
  },
} as const;

export interface SupportSection {
  heading: string | null;
  paragraphs: string[];
}

/**
 * Parse a project's support text: a line starting with "## " opens a section, blank
 * lines separate paragraphs. Text before the first heading becomes an untitled section.
 */
export function parseSupportBody(body: string | null | undefined): SupportSection[] {
  const sections: SupportSection[] = [];
  for (const block of (body ?? '').replace(/\r\n/g, '\n').split(/\n\s*\n/)) {
    const text = block.trim();
    if (!text) continue;
    if (text.startsWith('## ')) {
      const [heading, ...rest] = text.split('\n');
      sections.push({ heading: heading.slice(3).trim(), paragraphs: rest.length ? [rest.join(' ').trim()] : [] });
    } else if (sections.length) {
      sections[sections.length - 1].paragraphs.push(text.replace(/\n/g, ' '));
    } else {
      sections.push({ heading: null, paragraphs: [text.replace(/\n/g, ' ')] });
    }
  }
  return sections;
}
