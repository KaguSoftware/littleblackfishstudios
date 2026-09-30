import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHomeData } from "@/lib/queries/public";
import { serializeCategory, serializeProject } from "@/lib/serializers";
import { buildSphereData, localizedTitle, toBlurb } from "@/lib/sphere";
import type { SerializedProject } from "@/lib/types";
import ProjectGrid from "@/components/ProjectGrid/ProjectGrid";
import type { Project as CardProject } from "@/components/ProjectGrid/types";
import SphereExperience from "@/components/Sphere/SphereExperience";
import { SPHERE_COPY } from "@/components/Sphere/copy";
import { sphereFontVars } from "@/components/Sphere/fonts";
import type { SphereLocale } from "@/components/Sphere/types";

export const revalidate = 3600;

interface ProjectsPageProps {
	params: Promise<{ locale: string }>;
}

const METADATA: Record<SphereLocale, Metadata> = {
	en: {
		title: "Projects | Little Black Fish Studios",
		description:
			"Films, animations, series and stage work by Little Black Fish Studios, explored from inside an interactive 3D sphere.",
	},
	fa: {
		title: "پروژه‌ها | استودیو ماهی سیاه کوچولو",
		description:
			"نمونه کارهای استودیو ماهی سیاه کوچولو، از فیلم و انیمیشن تا مجموعه و نمایش، را در یک کره‌ی سه‌بعدی تعاملی ببینید.",
	},
};

export async function generateMetadata({
	params,
}: ProjectsPageProps): Promise<Metadata> {
	const { locale } = await params;
	return METADATA[locale === "fa" ? "fa" : "en"];
}

// Visually hidden, but revealed while a keyboard is on it (bottom corner, like the sphere's own list).
// The sr-only is on each link, not on the nav: it clips everything inside it, a focused link included.
const HIDDEN_LINK =
	"sr-only focus:not-sr-only focus:fixed focus:start-4 focus:bottom-20 focus:z-60 focus:rounded-[10px] focus:bg-[#f2f2f2] focus:px-3.5 focus:py-2.5 focus:text-xs focus:text-[#050505]";

// ProjectCard only shows the poster, the title and two lines of the page language's description.
// The fallback travels in the page payload even for visitors who never see it, so the rest
// (gallery, support texts, the other language) is left out.
const toCardProject = (
	project: SerializedProject,
	locale: SphereLocale,
): CardProject => ({
	id: project.id,
	slug: project.slug,
	youtubeUrl: project.youtubeUrl,
	imageUrl: project.imageUrl,
	mediaType: project.mediaType,
	galleryUrls: [],
	published: project.published,
	titleEn: project.titleEn,
	titleFa: project.titleFa,
	descriptionEn: locale === "en" ? toBlurb(project.descriptionEn) : null,
	descriptionFa: locale === "fa" ? toBlurb(project.descriptionFa) : null,
	order: project.order,
	createdAt: project.createdAt,
	updatedAt: project.updatedAt,
});

export default async function ProjectsPage({ params }: ProjectsPageProps) {
	const { locale } = await params;

	if (!["en", "fa"].includes(locale)) {
		notFound();
	}

	const sphereLocale = locale as SphereLocale;
	const copy = SPHERE_COPY[sphereLocale];

	const { projects: projectRows, categories: categoryRows } = await getHomeData();
	const projects = projectRows.map(serializeProject);
	const sphere = buildSphereData(
		projects,
		categoryRows.map(serializeCategory),
		sphereLocale,
	);

	// Shown instead of the sphere when WebGL is missing or the engine crashes.
	const fallback = (
		<div className="mx-auto max-w-7xl px-4 pt-28 pb-16 sm:px-6 lg:px-8">
			<header className="mb-8 md:mb-12">
				<div className="flex items-center gap-4 mb-4">
					<div className="h-px flex-1 bg-zinc-800"></div>
					<span className="text-xs font-bold tracking-[0.2em] text-zinc-400 uppercase rtl:text-sm rtl:font-normal rtl:tracking-normal">
						{copy.kicker}
					</span>
				</div>
				<h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl rtl:font-normal rtl:tracking-normal">
					{copy.title}
				</h1>
			</header>

			{projects.length > 0 ? (
				<ProjectGrid
					projects={projects.map((project) => toCardProject(project, sphereLocale))}
					locale={locale}
				/>
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
	);

	return (
		<main className={`${sphereFontVars} bg-black`}>
			<SphereExperience
				projects={sphere.projects}
				categories={sphere.categories}
				locale={sphereLocale}
				fallback={fallback}
			/>

			{/* The canvas is no use to crawlers, screen readers or keyboards: real links to every project. */}
			<nav aria-label={copy.allProjects}>
				<ul>
					{projects.map((project) => (
						<li key={project.id}>
							{/* Nobody can see these, so don't prefetch dozens of pages on load. */}
							<Link
								href={`/${locale}/projects/${project.slug}`}
								prefetch={false}
								className={HIDDEN_LINK}
							>
								{localizedTitle(project, sphereLocale)}
							</Link>
						</li>
					))}
				</ul>
			</nav>
		</main>
	);
}
