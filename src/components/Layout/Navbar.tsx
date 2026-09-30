"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Globe } from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";
import StaggeredMenuPanel, { StaggeredMenuToggle } from "./StaggeredMenu";

export default function Navbar({ locale }: { locale: string }) {
	const [isOpen, setIsOpen] = useState(false);
	const pathname = usePathname();
	const isRtl = locale === "fa";

	const isActive = (href: string) =>
		pathname.startsWith(href.split('#')[0]) && href !== `/${locale}/`;

	const { scrollY } = useScroll();
	const headerHeight = useTransform(scrollY, [0, 120], [96, 72]);
	const logoSize = useTransform(scrollY, [0, 120], [48, 36]);
	const blurOpacity = useTransform(scrollY, [0, 80], [0, 1]);

	useEffect(() => {
		if (isOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "unset";
		}
		return () => {
			document.body.style.overflow = "unset";
		};
	}, [isOpen]);

	// Close on navigation
	const [prevPathname, setPrevPathname] = useState(pathname);
	if (pathname !== prevPathname) {
		setPrevPathname(pathname);
		setIsOpen(false);
	}

	// Close on Escape, and when the viewport grows past the mobile breakpoint
	useEffect(() => {
		if (!isOpen) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setIsOpen(false);
		};
		const mq = window.matchMedia("(min-width: 768px)");
		const onBreakpoint = () => {
			if (mq.matches) setIsOpen(false);
		};
		window.addEventListener("keydown", onKey);
		mq.addEventListener("change", onBreakpoint);
		return () => {
			window.removeEventListener("keydown", onKey);
			mq.removeEventListener("change", onBreakpoint);
		};
	}, [isOpen]);

	const toggleLanguage = () => {
		const segments = pathname.split("/");
		const currentLocale = segments[1];
		const newLocale = currentLocale === "en" ? "fa" : "en";
		segments[1] = newLocale;
		window.location.href = segments.join("/");
	};

	const navLinks = [
		{
			href: `/${locale}/projects`,
			label: isRtl ? "پروژه‌ها" : "Projects",
		},
		{ href: `/${locale}/about`, label: isRtl ? "درباره ما" : "About" },
		{ href: `/${locale}/contact`, label: isRtl ? "تماس" : "Contact" },
		{ href: `/${locale}/support`, label: isRtl ? "حمایت" : "Support" },
	];

	return (
		<>
			<motion.header
				initial={{ y: -100, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
				style={{ height: headerHeight }}
				className="fixed top-0 left-0 right-0 z-50"
			>
				<div className="absolute inset-0 z-0 pointer-events-none">
					<div className="absolute inset-0 bg-black md:bg-transparent" />
					<div className="absolute inset-0 bg-linear-to-b from-black/80 to-transparent hidden md:block" />
					<motion.div
						style={{ opacity: blurOpacity }}
						className="absolute inset-0 bg-black/90 backdrop-blur-md hidden md:block"
					/>
					<div className="absolute inset-0 bg-black md:hidden" />
				</div>

				<div className="relative z-10 container mx-auto px-6 h-full flex items-center justify-between">
					<Link
						href={`/${locale}`}
						className="flex items-center gap-3 group"
					>
						<motion.div
							style={{ width: logoSize, height: logoSize }}
							className="relative shrink-0"
							whileHover={{ rotate: -8, scale: 1.05 }}
							transition={{ type: "spring", stiffness: 300, damping: 15 }}
						>
							<Image
								src="/logo-icon-white.png"
								fill
								sizes="48px"
								alt="Little Black Fish"
								className="object-contain"
							/>
						</motion.div>
						<span className="font-lalezar text-xl md:text-2xl text-white tracking-wide whitespace-nowrap transition-opacity group-hover:opacity-80">
							{isRtl
								? "استودیو ماهی سیاه کوچولو"
								: "Little Black Fish"}
						</span>
					</Link>

					<div className="hidden md:flex items-center gap-10">
						{navLinks.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								className={`relative group font-black uppercase text-xs tracking-[0.3em] transition-colors ${
									isActive(link.href)
										? 'text-white'
										: 'text-white/60 hover:text-white'
								}`}
							>
								<span>{link.label}</span>
								<motion.span
									className={`absolute -bottom-1 ${isRtl ? "right-0" : "left-0"} h-px bg-blue-500`}
									initial={{ width: isActive(link.href) ? '100%' : '0%' }}
									animate={{ width: isActive(link.href) ? '100%' : '0%' }}
									whileHover={{ width: '100%' }}
									transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
									style={{ transformOrigin: isRtl ? "right" : "left" }}
								/>
							</Link>
						))}

						<motion.button
							onClick={toggleLanguage}
							whileHover={{ scale: 1.05 }}
							whileTap={{ scale: 0.95 }}
							transition={{ type: "spring", stiffness: 400, damping: 17 }}
							className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black"
						>
							<Globe size={14} />
							{locale === "en" ? "FA" : "EN"}
						</motion.button>
					</div>

					<div className="md:hidden">
						<StaggeredMenuToggle
							open={isOpen}
							onToggle={() => setIsOpen((v) => !v)}
							labels={isRtl ? ["منو", "بستن"] : ["Menu", "Close"]}
						/>
					</div>
				</div>
			</motion.header>

			<div className="md:hidden">
				<StaggeredMenuPanel
					open={isOpen}
					position={isRtl ? "left" : "right"}
					dir={isRtl ? "rtl" : "ltr"}
					items={navLinks.map((link) => ({
						label: link.label,
						href: link.href,
						active: isActive(link.href),
						onClick: () => setIsOpen(false),
					}))}
					footer={
						<button
							onClick={() => {
								toggleLanguage();
								setIsOpen(false);
							}}
							className="w-full flex items-center justify-center gap-3 rounded-full border border-white/15 bg-white/5 px-6 py-4 text-sm font-black uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-black active:scale-[0.98]"
						>
							<Globe size={16} />
							{locale === "en" ? "Persian (FA)" : "English (EN)"}
						</button>
					}
				/>
			</div>
		</>
	);
}
