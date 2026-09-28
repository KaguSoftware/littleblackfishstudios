import type {
  Project,
  HeroSlide,
  Category,
  ContactSubmission,
  SerializedProject,
  SerializedHeroSlide,
  SerializedCategory,
  SerializedContactSubmission,
} from './types';

export function serializeProject(row: Project): SerializedProject {
  return {
    id: row.id,
    slug: row.slug,
    youtubeUrl: row.youtube_url ?? null,
    imageUrl: row.image_url ?? null,
    mediaType: row.media_type ?? 'youtube',
    galleryUrls: row.gallery_urls ?? [],
    published: row.published,
    titleEn: row.title_en,
    titleFa: row.title_fa,
    descriptionEn: row.description_en ?? null,
    descriptionFa: row.description_fa ?? null,
    categoryId: row.category_id ?? null,
    order: row.order,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    supportEnabled: row.support_enabled ?? false,
    supportTitleEn: row.support_title_en ?? null,
    supportTitleFa: row.support_title_fa ?? null,
    supportIntroEn: row.support_intro_en ?? null,
    supportIntroFa: row.support_intro_fa ?? null,
    supportBodyEn: row.support_body_en ?? null,
    supportBodyFa: row.support_body_fa ?? null,
    supportClosingEn: row.support_closing_en ?? null,
    supportClosingFa: row.support_closing_fa ?? null,
    supportEpisodesDone: row.support_episodes_done ?? null,
    supportEpisodesTotal: row.support_episodes_total ?? null,
  };
}

export function serializeHeroSlide(row: HeroSlide): SerializedHeroSlide {
  return {
    id: row.id,
    titleEn: row.title_en ?? null,
    titleFa: row.title_fa ?? null,
    subtitleEn: row.subtitle_en ?? null,
    subtitleFa: row.subtitle_fa ?? null,
    imageUrl: row.image_url ?? null,
    youtubeUrl: row.youtube_url ?? null,
    order: row.order,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function serializeContactSubmission(
  row: ContactSubmission,
): SerializedContactSubmission {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    message: row.message,
    emailSent: row.email_sent,
    emailError: row.email_error,
    read: row.read,
    createdAt: new Date(row.created_at),
  };
}

export function serializeCategory(row: Category): SerializedCategory {
  return {
    id: row.id,
    slug: row.slug,
    nameEn: row.name_en,
    nameFa: row.name_fa,
    order: row.order,
    visible: row.visible,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
