"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ChevronDown, Instagram, Youtube } from "lucide-react";
import { getYouTubeId, getYouTubeMaxResThumbnail } from "@/lib/youtube";
import type { HeroProps } from "./types";

const HeroClient: React.FC<HeroProps> = ({ slides, locale }) => {
	const [current, setCurrent] = useState(0);
	const [isPaused, setIsPaused] = useState(false);
	const [scrolled, setScrolled] = useState(false);
	const isRtl = locale === "fa";
	const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 80);
		onScroll();
		window.addEventListener("scroll", onScroll, { passive: true });
		return () => window.removeEventListener("scroll", onScroll);
	}, []);

	const scrollToProjects = useCallback(() => {
		// the globe is the first thing under the hero; without it (no projects) fall back to the list
		(document.getElementById("sphere") ?? document.getElementById("projects"))?.scrollIntoView({ behavior: "smooth" });
	}, []);

	// Track which YouTube slides have been activated (iframe loaded)
	const [activatedSlides, setActivatedSlides] = useState<Set<string>>(
		() => new Set(slides[0]?.youtubeUrl ? [slides[0].id] : [])
	);

	const handleNext = useCallback(() => {
		setCurrent((prev) => (prev + 1) % slides.length);
	}, [slides.length]);

	const handlePrev = useCallback(() => {
		setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
	}, [slides.length]);

	// Auto-play logic with interaction pause
	useEffect(() => {
		if (slides.length <= 1 || isPaused) return;

		const timer = setInterval(() => {
			handleNext();
		}, 8000);

		return () => clearInterval(timer);
	}, [slides.length, isPaused, handleNext]);

	// Pause auto-play for 10 seconds on interaction; clears any pending resume timer
	const triggerInteraction = useCallback(() => {
		setIsPaused(true);
		if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
		resumeTimerRef.current = setTimeout(() => {
			setIsPaused(false);
		}, 10000);
	}, []);

	// Activate the YouTube iframe when a slide becomes current (state adjusted during render, not in an effect)
	const currentYoutubeSlide = slides[current]?.youtubeUrl ? slides[current] : null;
	if (currentYoutubeSlide && !activatedSlides.has(currentYoutubeSlide.id)) {
		setActivatedSlides((prev) => new Set(prev).add(currentYoutubeSlide.id));
	}

	const isVideo = (url: string) => /\.(mp4|webm|ogg|mov)$/i.test(url);

	if (!slides || slides.length === 0) return null;

	const currentSlide = slides[current];
	const title = isRtl ? currentSlide.titleFa : currentSlide.titleEn;
	const subtitle = isRtl ? currentSlide.subtitleFa : currentSlide.subtitleEn;

	return (
		<div className="relative w-full mt-20 md:mt-0 h-[calc(88svh-5rem)] md:h-screen overflow-hidden bg-black">
			<AnimatePresence mode="wait">
				<motion.div
					key={currentSlide.id}
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					transition={{ duration: 1.5, ease: "easeInOut" }}
					className="absolute inset-0"
				>
					{/* Mobile gradient overlay so bottom-anchored text stays legible */}
					<div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-black/70 to-transparent md:hidden z-10 pointer-events-none" />

					{/* Background Media */}
					<motion.div
						initial={{ scale: 1.1 }}
						animate={{ scale: 1 }}
						transition={{ duration: 12, ease: "easeOut" }}
						className="absolute inset-0"
					>
						{currentSlide.youtubeUrl ? (
							activatedSlides.has(currentSlide.id) ? (
								<div className="absolute inset-0 h-full w-full pointer-events-none overflow-hidden">
									<iframe
										src={`https://www.youtube.com/embed/${getYouTubeId(currentSlide.youtubeUrl)}?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&iv_load_policy=3&playlist=${getYouTubeId(currentSlide.youtubeUrl)}&vq=hd1080&modestbranding=1&disablekb=1&fs=0&cc_load_policy=0`}
										className="absolute top-1/2 left-1/2 w-full h-full md:w-[300%] md:h-[300%] -translate-x-1/2 -translate-y-1/2 object-contain md:object-cover opacity-0 transition-opacity duration-700"
										allow="autoplay; encrypted-media"
										frameBorder="0"
										onLoad={(e) => {
											(e.currentTarget as HTMLIFrameElement).style.opacity = '1';
										}}
									/>
								</div>
							) : (
								<Image
									src={getYouTubeMaxResThumbnail(currentSlide.youtubeUrl)!}
									alt={title || "Hero background"}
									fill
									priority
									className="object-contain md:object-cover"
								/>
							)
						) : currentSlide.imageUrl &&
						  isVideo(currentSlide.imageUrl) ? (
							<>
								{currentSlide.posterUrl && (
									<Image
										src={currentSlide.posterUrl}
										alt={title || "Hero background"}
										fill
										priority
										className="object-contain md:object-cover"
									/>
								)}
								<video
									key={currentSlide.imageUrl}
									src={currentSlide.imageUrl}
									className="absolute inset-0 h-full w-full object-contain md:object-cover"
									autoPlay
									muted
									loop
									playsInline
									preload="metadata"
									// Storage down or file missing: hide the video so the poster shows through
									onError={(e) => {
										e.currentTarget.style.display = "none";
									}}
								/>
							</>
						) : currentSlide.imageUrl ? (
							<Image
								src={currentSlide.imageUrl}
								alt={title || "Hero background"}
								fill
								priority
								className="object-contain md:object-cover"
							/>
						) : null}
					</motion.div>

					{/* Content Container */}
					{(title || subtitle) && (
						<div className="relative z-20 flex h-full items-end md:items-center justify-center px-4 md:px-6 pb-12 md:pb-0 text-center">
							<div className="max-w-6xl">
								<motion.div
									initial={{ y: 40, opacity: 0 }}
									animate={{ y: 0, opacity: 1 }}
									transition={{
										delay: 0.5,
										duration: 1,
										ease: "easeOut",
									}}
									className="space-y-4 md:space-y-6 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]"
								>
									{title && (
										<>
											<h1
												className={`font-black tracking-tighter text-white uppercase leading-none
                        ${isRtl ? "text-3xl sm:text-5xl md:text-8xl" : "text-4xl sm:text-6xl md:text-9xl"}`}
											>
												{title}
											</h1>
											<div className="mx-auto h-1 md:h-1.5 w-16 md:w-32 bg-blue-600/90 shadow-xl" />
										</>
									)}

									{subtitle && (
										<p className="mx-auto max-w-2xl text-sm sm:text-lg font-bold tracking-wide text-zinc-100 md:text-2xl">
											{subtitle}
										</p>
									)}
								</motion.div>
							</div>
						</div>
					)}
				</motion.div>
			</AnimatePresence>

			{/* Navigation Arrows */}
			{slides.length > 1 && (
				<>
					<button
						type="button"
						onClick={() => {
							triggerInteraction();
							handlePrev();
						}}
						className="absolute left-3 md:left-6 top-1/2 z-40 -translate-y-1/2 rounded-full p-2 md:p-4 text-white/40 transition-all hover:bg-black/20 hover:text-white drop-shadow-md"
						aria-label="Previous slide"
					>
						<ChevronLeft className="h-6 w-6 md:h-12 md:w-12" />
					</button>
					<button
						type="button"
						onClick={() => {
							triggerInteraction();
							handleNext();
						}}
						className="absolute right-3 md:right-6 top-1/2 z-40 -translate-y-1/2 rounded-full p-2 md:p-4 text-white/40 transition-all hover:bg-black/20 hover:text-white drop-shadow-md"
						aria-label="Next slide"
					>
						<ChevronRight className="h-6 w-6 md:h-12 md:w-12" />
					</button>
				</>
			)}

			{/* Slide Indicators */}
			{slides.length > 1 && (
				<div className="absolute bottom-8 md:bottom-12 left-1/2 flex -translate-x-1/2 gap-2 md:gap-4 z-40">
					{slides.map((slide, index) => (
						<button
							type="button"
							key={slide.id}
							onClick={() => {
								triggerInteraction();
								setCurrent(index);
							}}
							aria-label={`Go to slide ${index + 1}`}
							className={`h-1 rounded-full transition-all duration-700 shadow-lg ${
								current === index
									? "w-16 bg-white"
									: "w-4 bg-white/20"
							}`}
						/>
					))}
				</div>
			)}

			{/* Scroll Decorator */}
			<div className="absolute bottom-10 left-10 hidden md:block z-40 drop-shadow-md">
				<div className="flex items-center gap-4 rotate-90 origin-left translate-y-24">
					<span className="text-[10px] font-black tracking-[0.5em] text-zinc-100 uppercase">
						Scroll to explore
					</span>
					<div className="h-px w-20 bg-zinc-100/50" />
				</div>
			</div>

			{/* Social Icons (bottom-right on mobile, bottom-left column on desktop) */}
			<div className="absolute bottom-4 right-4 flex flex-row gap-4 md:bottom-8 md:left-8 md:right-auto md:flex-col md:gap-3 z-40 drop-shadow-md">
				<a
					href="https://www.instagram.com/littleblackfishstudio/"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="Instagram"
					className="text-zinc-100/70 transition-all hover:text-white hover:scale-110"
				>
					<Instagram className="h-5 w-5" />
				</a>
				<a
					href="https://www.youtube.com/@Littleblackfishstudio"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="YouTube"
					className="text-zinc-100/70 transition-all hover:text-white hover:scale-110"
				>
					<Youtube className="h-5 w-5" />
				</a>
			</div>

			{/* Scroll cue (bouncing chevron) */}
			<button
				type="button"
				onClick={scrollToProjects}
				aria-label="Scroll to projects"
				className={`absolute bottom-2 md:bottom-3 left-1/2 -translate-x-1/2 z-30 text-white/60 hover:text-white drop-shadow-md transition-opacity duration-500 ${
					scrolled ? "opacity-0 pointer-events-none" : "opacity-100"
				}`}
			>
				<motion.div
					animate={{ y: [0, 8, 0] }}
					transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
				>
					<ChevronDown className="h-7 w-7 md:h-8 md:w-8" />
				</motion.div>
			</button>
		</div>
	);
};

export default HeroClient;
