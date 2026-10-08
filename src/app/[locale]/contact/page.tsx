'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { sendContactEmail } from '@/actions/contact';
import { Loader2, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence, type Variants } from 'framer-motion';

const EASE_SNAPPY: [number, number, number, number] = [0.22, 1, 0.36, 1];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE_SNAPPY },
  },
};

export default function ContactPage() {
  const t = useTranslations('Contact');
  const params = useParams();
  const locale = params?.locale as string;
  const isRtl = locale === 'fa';
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus('idle');

    const formData = new FormData(e.currentTarget);
    const result = await sendContactEmail(formData);

    if (result.success) {
      setStatus('success');
      (e.target as HTMLFormElement).reset();
    } else {
      setStatus('error');
      setErrorMsg(result.error ?? 'Unknown error');
    }
    setLoading(false);

    setTimeout(() => setStatus('idle'), 5000);
  }

  const title = isRtl ? 'شروع پروژه' : 'Start a Project';
  const btnText = isRtl ? 'ارسال پیشنهاد' : 'Send Proposal';
  const phoneLabel = isRtl ? 'شماره تماس' : 'Phone';
  const detailsLabel = isRtl ? 'جزئیات پروژه' : 'Project Details';

  const inputCls =
    'w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-white placeholder:text-zinc-700 focus:border-white focus:outline-none transition-all';
  const labelCls =
    `text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 ${isRtl ? 'mr-1' : 'ml-1'}`;

  const buttonStateKey = loading
    ? 'loading'
    : status === 'success'
      ? 'success'
      : status === 'error'
        ? 'error'
        : 'idle';

  return (
    <div className="min-h-screen bg-black pt-44 pb-20 px-6">
      <div className="mx-auto max-w-2xl">
        <motion.div
          className="space-y-12"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants} className="space-y-4">
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none">
              {title}
            </h1>
            <div className="h-1.5 w-24 bg-blue-600" />
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* honeypot: hidden from people, bots fill it in */}
            <input name="website" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className={labelCls}>{t('name')}</label>
                <input name="name" type="text" required autoComplete="name" className={inputCls} />
              </div>
              <div className="space-y-3">
                <label className={labelCls}>{t('email')}</label>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </div>
              <div className="space-y-3 md:col-span-2">
                <label className={labelCls}>{phoneLabel}</label>
                <input
                  name="phone"
                  type="tel"
                  required
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+1 555 000 0000"
                  className={inputCls}
                  dir="ltr"
                />
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-3">
              <label className={labelCls}>{detailsLabel}</label>
              <textarea
                name="message"
                required
                rows={6}
                className={`${inputCls} resize-none`}
              />
            </motion.div>

            <motion.button
              variants={itemVariants}
              type="submit"
              disabled={loading || status !== 'idle'}
              whileTap={{ scale: 0.98 }}
              className={`group relative w-full overflow-hidden rounded-xl py-6 font-black uppercase tracking-[0.3em] transition-colors disabled:cursor-default disabled:opacity-100 ${
                status === 'success'
                  ? 'bg-green-500 text-black'
                  : status === 'error'
                    ? 'bg-red-500 text-black'
                    : 'bg-white text-black hover:bg-zinc-200'
              }`}
              title={status === 'error' && errorMsg ? errorMsg : undefined}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={buttonStateKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22, ease: EASE_SNAPPY }}
                  className="relative z-10 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      <span>{t('sending')}</span>
                    </>
                  ) : status === 'success' ? (
                    <>
                      <CheckCircle size={20} />
                      <span>{t('success')}</span>
                    </>
                  ) : status === 'error' ? (
                    <>
                      <AlertCircle size={20} />
                      <span>{t('error')}</span>
                    </>
                  ) : (
                    <>
                      <Send size={18} />
                      <span>{btnText}</span>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
