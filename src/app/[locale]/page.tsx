import { getHomeData } from "@/lib/queries/public";
import Hero from "@/components/Hero/Hero";
import ProjectGrid from "@/components/ProjectGrid/ProjectGrid";
import CategoryCarouselSection from "@/components/ProjectGrid/CategoryCarouselSection";
import { notFound } from "next/navigation";
import {
	serializeProject,
	serializeHeroSlide,
	serializeCategory,
} from "@/lib/serializers";
import { getYouTubeMaxResThumbnail } from "@/lib/youtube";
import { buildSphereData } from "@/lib/sphere";
import HomeGlobe from "@/components/Sphere/HomeGlobe";
import { sphereFontVars } from "@/components/Sphere/fonts";
import type { SphereLocale } from "@/components/Sphere/types";

export const revalidate = 3600;

// Hides the "Recent Projects" section on the home page. Flip to true to show it again.
const SHOW_RECENT_PROJECTS = false;

interface HomePageProps {
	params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: HomePageProps) {
	const { locale } = await params;

	if (!["en", "fa"].includes(locale)) {
		notFound();
	}

	const {
		slides: slideRows,
		projects: projectRows,
		categories: categoryRows,
	} = await getHomeData();

	const projects = projectRows.map(serializeProject);

	// Video slides get a still poster from the project named in the file (".../<id>-Gilgamesh.mp4"),
	// so the hero isn't black while the video loads or if storage can't serve it.
	const posterFor = (url: string | null) => {
		const file = url?.split("/").pop()?.toLowerCase() ?? "";
		if (!/\.(mp4|webm|ogg|mov)$/.test(file)) return null;
		const project = projects.find((p) => file.includes(p.slug));
		return project ? getYouTubeMaxResThumbnail(project.youtubeUrl) ?? project.imageUrl : null;
	};
	const slides = slideRows.map((row) => ({
		...serializeHeroSlide(row),
		posterUrl: posterFor(row.image_url),
	}));
	const categories = categoryRows.map(serializeCategory);
	const sphere = buildSphereData(projects, categories, locale as SphereLocale);

	const projectsByCategory = new Map<string, typeof projects>();
	for (const p of projects) {
		const key = p.categoryId ?? "__uncategorized__";
		const list = projectsByCategory.get(key) ?? [];
		list.push(p);
		projectsByCategory.set(key, list);
	}
	const uncategorized = projectsByCategory.get("__uncategorized__") ?? [];

	const hasAnyCategoryProjects = categories.some(
		(c) => (projectsByCategory.get(c.id) ?? []).length > 0,
	);

	return (
		<main className="min-h-screen bg-black">
			{/* Cinematic Hero Section */}
			<Hero slides={slides} locale={locale} />

			{/* The globe: the projects sphere seen from outside, and the way into it */}
			<div className={sphereFontVars}>
				<HomeGlobe projects={sphere.projects} locale={locale as SphereLocale} />
			</div>

			{/* Content Section */}
			{SHOW_RECENT_PROJECTS && (
			<div
				id="projects"
				className="mx-auto max-w-7xl px-4 py-12 md:py-24 sm:px-6 lg:px-8 scroll-mt-28 md:scroll-mt-24"
			>
				<header className="mb-8 md:mb-16">
					<div className="flex items-center gap-4 mb-4">
						<div className="h-px flex-1 bg-zinc-800"></div>
						<span className="text-xs font-bold tracking-[0.2em] text-blue-500 uppercase">
							{locale === "fa" ? "نمونه کارها" : "Portfolio"}
						</span>
					</div>
					<h2 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
						{locale === "fa" ? "پروژه‌های اخیر" : "Recent Projects"}
					</h2>
				</header>

				{hasAnyCategoryProjects ? (
					<>
						{categories.map((category) => {
							const items = projectsByCategory.get(category.id) ?? [];
							if (items.length === 0) return null;
							return (
								<CategoryCarouselSection
									key={category.id}
									category={category}
									projects={items}
									locale={locale}
								/>
							);
						})}

						{uncategorized.length > 0 && (
							<section className="mb-12 md:mb-20">
								<header className="mb-4">
									<h3 className="text-2xl md:text-3xl font-black tracking-tight text-white">
										{locale === "fa" ? "سایر پروژه‌ها" : "Other Projects"}
									</h3>
									<div className="mt-2 h-0.5 w-12 bg-blue-600/80" />
								</header>
								<ProjectGrid projects={uncategorized} locale={locale} />
							</section>
						)}
					</>
				) : projects.length > 0 ? (
					<ProjectGrid projects={projects} locale={locale} />
				) : (
					<div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
						<p className="text-zinc-500 font-light italic">
							{locale === "fa"
								? "هیچ پروژه‌ای یافت نشد."
								: "No projects found in the archive."}
						</p>
					</div>
				)}
			</div>
			)}
		</main>
	);
}
