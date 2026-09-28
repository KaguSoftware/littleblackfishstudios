/**
 * Gumroad product URL ("pay what you want", so the supporter names their own amount).
 *
 * Use the custom permalink (/coffee), NOT the /l/<id> form: the latter 302-redirects
 * to /coffee and drops any query string.
 */
export const SUPPORT_URL = 'https://lbfstudios.gumroad.com/coffee';

/** tlcard charge page for supporters in Iran, who can't pay through Gumroad. */
export const SUPPORT_URL_IRAN = 'https://tlcard.ir/charge/7603/8565';

export const SUPPORT_PAGE = {
  en: {
    eyebrow: 'Support',
    title: 'Support Modern Shahnameh',
    lede: "Modern Shahnameh is an independent 100-episode series that retells the stories of Ferdowsi's Shahnameh from the very beginning, step by step, in a visual, cinematic, contemporary language.",
    progress: { done: 12, total: 100, label: 'episodes released so far' },
    sections: [
      {
        heading: 'What is Modern Shahnameh?',
        body: [
          "This series is not simply an illustration of an ancient text or a historical reconstruction. We are trying to tell the world of the Shahnameh, its characters, choices, defeats and victories, with a fresh eye rooted in Iranian culture, so that today's generation and audiences around the world can connect with these stories again.",
        ],
      },
      {
        heading: 'Why are we making it?',
        body: [
          'The Shahnameh is not just a collection of battles and kings. It is part of our memory, our imagination and our cultural identity. But preserving these stories is not enough to keep them alive. They have to be retold, seen, and brought into the language of our time.',
          "Our goal is to build a contemporary, independent visual archive of the Shahnameh: a 100-episode series that takes this heritage off the page and turns it into a living experience that today's generation can watch and share.",
          'So far, 12 episodes have been made and released, and production of the next ones continues.',
        ],
      },
      {
        heading: 'How does your support help?',
        body: [
          'Every episode involves research and rereading of the Shahnameh, story and character design, image and video production, music, sound design, editing and post-production.',
          'The project will continue either way, but support from the audience helps the next episodes come out faster, more regularly and at a consistent quality, bringing us closer to a weekly release schedule.',
          'If this journey matters to you, you can support it with any amount you like. The amount is entirely your choice, with no minimum and no obligation.',
        ],
      },
    ],
    disclaimer:
      'Support is voluntary and no product or service is provided in return. It is not a purchase, an investment, ownership or commercial sponsorship. It is simply a way to stand behind the making of Modern Shahnameh.',
    chooseHeading: 'Choose how to support',
    iran: { heading: 'Paying from inside Iran', label: 'Support in Rial', caption: 'Iranian bank card' },
    worldwide: { heading: 'Paying from outside Iran', label: 'Support in Dollars', caption: 'Card, any amount' },
    closing:
      'One hundred episodes, one long road, so the stories of the Shahnameh are seen and heard again.',
    metaTitle: 'Support Modern Shahnameh | Little Black Fish Studios',
    metaDescription:
      "Support Modern Shahnameh, an independent 100-episode series retelling Ferdowsi's Shahnameh in a cinematic, contemporary language.",
  },
  fa: {
    eyebrow: 'حمایت',
    title: 'از شاهنامه مدرن حمایت کنید',
    lede: 'شاهنامه مدرن یک مجموعهٔ مستقل صدقسمتی است که داستان‌های شاهنامهٔ فردوسی را از آغاز، قدم‌به‌قدم و با زبانی تصویری، سینمایی و معاصر بازآفرینی می‌کند.',
    progress: { done: 12, total: 100, label: 'قسمت تا امروز منتشر شده' },
    sections: [
      {
        heading: 'شاهنامه مدرن چیست؟',
        body: [
          'این مجموعه صرفاً تصویرسازی یک متن کهن یا بازسازی تاریخی نیست. ما تلاش می‌کنیم جهان شاهنامه، شخصیت‌ها، انتخاب‌ها، شکست‌ها و پیروزی‌های آن را با نگاهی تازه و ریشه‌دار در فرهنگ ایران روایت کنیم؛ به شکلی که نسل امروز و مخاطبان سراسر جهان بتوانند دوباره با این داستان‌ها ارتباط برقرار کنند.',
        ],
      },
      {
        heading: 'چرا این پروژه را می‌سازیم؟',
        body: [
          'شاهنامه فقط مجموعه‌ای از نبردها و پادشاهان نیست؛ بخشی از حافظه، تخیل و هویت فرهنگی ماست. اما برای زنده‌ماندن این داستان‌ها، تنها حفظ آن‌ها کافی نیست؛ باید دوباره روایت شوند، دیده شوند و به زبان زمانهٔ ما درآیند.',
          'هدف ما ساختن یک آرشیو تصویری معاصر و مستقل از شاهنامه است؛ مجموعه‌ای صدقسمتی که این میراث را از دل کتاب بیرون بیاورد و به تجربه‌ای زنده، قابل‌دیدن و قابل‌اشتراک برای نسل امروز تبدیل کند.',
          'تا امروز ۱۲ قسمت از این مسیر ساخته و منتشر شده است و تولید قسمت‌های بعدی ادامه دارد.',
        ],
      },
      {
        heading: 'حمایت شما چه کمکی می‌کند؟',
        body: [
          'ساخت هر قسمت شامل تحقیق و بازخوانی شاهنامه، طراحی روایت و شخصیت‌ها، تولید تصاویر و ویدئوها، موسیقی، طراحی صدا، تدوین و پس‌تولید است.',
          'این پروژه در هر صورت ادامه پیدا می‌کند؛ اما حمایت مالی مخاطبان کمک می‌کند قسمت‌های بعدی سریع‌تر، منظم‌تر و با کیفیتی پایدار تولید شوند و بتوانیم به برنامهٔ انتشار هفتگی نزدیک‌تر شویم.',
          'اگر این مسیر برای شما ارزشمند است، می‌توانید با هر مبلغی که مایل هستید از ادامهٔ آن حمایت کنید. مبلغ حمایت کاملاً به انتخاب شماست و هیچ حداقل یا الزام مشخصی وجود ندارد.',
        ],
      },
    ],
    disclaimer:
      'این حمایت داوطلبانه است و در مقابل آن محصول یا خدماتی ارائه نمی‌شود. حمایت مالی به‌معنای خرید، سرمایه‌گذاری، مالکیت یا اسپانسرینگ تجاری نیست؛ فقط همراهی با ادامهٔ ساخت شاهنامه مدرن است.',
    chooseHeading: 'انتخاب روش حمایت',
    iran: { heading: 'پرداخت از داخل ایران', label: 'حمایت ریالی', caption: 'کارت بانکی ایرانی' },
    worldwide: { heading: 'پرداخت از خارج ایران', label: 'حمایت دلاری', caption: 'کارت بین‌المللی، مبلغ دلخواه' },
    closing: 'صد قسمت، یک مسیر بلند؛ برای اینکه داستان‌های شاهنامه دوباره دیده و شنیده شوند.',
    metaTitle: 'حمایت از شاهنامه مدرن | استودیو ماهی سیاه کوچولو',
    metaDescription:
      'از شاهنامه مدرن حمایت کنید؛ مجموعه‌ای مستقل و صدقسمتی که داستان‌های شاهنامهٔ فردوسی را با زبانی سینمایی و معاصر بازآفرینی می‌کند.',
  },
} as const;
