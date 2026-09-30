-- Rename the Shahnameh series to "Shahnameh: Land of Crown and Legend" / "شاه نامه : سرزمینِ تاج و افسانه".
-- Only touches the series name; mentions of Ferdowsi's Shahnameh (the book) are left as they are.
update public.projects set
  title_en = $n$Shahnameh: Land of Crown and Legend$n$,
  title_fa = $n$شاه نامه : سرزمینِ تاج و افسانه$n$,
  support_title_en = $n$Support Shahnameh: Land of Crown and Legend$n$,
  support_title_fa = $n$از شاه نامه : سرزمینِ تاج و افسانه حمایت کنید$n$,
  support_intro_en = $n$Shahnameh: Land of Crown and Legend is an independent 100-episode series that retells the stories of Ferdowsi's Shahnameh from the very beginning, step by step, in a visual, cinematic, contemporary language.$n$,
  support_intro_fa = $n$شاه نامه : سرزمینِ تاج و افسانه یک مجموعهٔ مستقل صدقسمتی است که داستان‌های شاهنامهٔ فردوسی را از آغاز، قدم‌به‌قدم و با زبانی تصویری، سینمایی و معاصر بازآفرینی می‌کند.$n$,
  support_body_en = $n$## What is Shahnameh: Land of Crown and Legend?

This series is not simply an illustration of an ancient text or a historical reconstruction. We are trying to tell the world of the Shahnameh, its characters, choices, defeats and victories, with a fresh eye rooted in Iranian culture, so that today's generation and audiences around the world can connect with these stories again.

## Why are we making it?

The Shahnameh is not just a collection of battles and kings. It is part of our memory, our imagination and our cultural identity. But preserving these stories is not enough to keep them alive. They have to be retold, seen, and brought into the language of our time.

Our goal is to build a contemporary, independent visual archive of the Shahnameh: a 100-episode series that takes this heritage off the page and turns it into a living experience that today's generation can watch and share.

So far, 12 episodes have been made and released, and production of the next ones continues.

## How does your support help?

Every episode involves research and rereading of the Shahnameh, story and character design, image and video production, music, sound design, editing and post-production.

The project will continue either way, but support from the audience helps the next episodes come out faster, more regularly and at a consistent quality, bringing us closer to a weekly release schedule.

If this journey matters to you, you can support it with any amount you like. The amount is entirely your choice, with no minimum and no obligation.$n$,
  support_body_fa = $n$## شاه نامه : سرزمینِ تاج و افسانه چیست؟

این مجموعه صرفاً تصویرسازی یک متن کهن یا بازسازی تاریخی نیست. ما تلاش می‌کنیم جهان شاهنامه، شخصیت‌ها، انتخاب‌ها، شکست‌ها و پیروزی‌های آن را با نگاهی تازه و ریشه‌دار در فرهنگ ایران روایت کنیم؛ به شکلی که نسل امروز و مخاطبان سراسر جهان بتوانند دوباره با این داستان‌ها ارتباط برقرار کنند.

## چرا این پروژه را می‌سازیم؟

شاهنامه فقط مجموعه‌ای از نبردها و پادشاهان نیست؛ بخشی از حافظه، تخیل و هویت فرهنگی ماست. اما برای زنده‌ماندن این داستان‌ها، تنها حفظ آن‌ها کافی نیست؛ باید دوباره روایت شوند، دیده شوند و به زبان زمانهٔ ما درآیند.

هدف ما ساختن یک آرشیو تصویری معاصر و مستقل از شاهنامه است؛ مجموعه‌ای صدقسمتی که این میراث را از دل کتاب بیرون بیاورد و به تجربه‌ای زنده، قابل‌دیدن و قابل‌اشتراک برای نسل امروز تبدیل کند.

تا امروز ۱۲ قسمت از این مسیر ساخته و منتشر شده است و تولید قسمت‌های بعدی ادامه دارد.

## حمایت شما چه کمکی می‌کند؟

ساخت هر قسمت شامل تحقیق و بازخوانی شاهنامه، طراحی روایت و شخصیت‌ها، تولید تصاویر و ویدئوها، موسیقی، طراحی صدا، تدوین و پس‌تولید است.

این پروژه در هر صورت ادامه پیدا می‌کند؛ اما حمایت مالی مخاطبان کمک می‌کند قسمت‌های بعدی سریع‌تر، منظم‌تر و با کیفیتی پایدار تولید شوند و بتوانیم به برنامهٔ انتشار هفتگی نزدیک‌تر شویم.

اگر این مسیر برای شما ارزشمند است، می‌توانید با هر مبلغی که مایل هستید از ادامهٔ آن حمایت کنید. مبلغ حمایت کاملاً به انتخاب شماست و هیچ حداقل یا الزام مشخصی وجود ندارد.$n$
where slug = 'shahname-microseries';
