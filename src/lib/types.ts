export interface Project {
  id: string;
  slug: string;
  youtube_url: string | null;
  image_url: string | null;
  media_type: string;
  gallery_urls: string[];
  published: boolean;
  title_en: string;
  title_fa: string;
  description_en: string | null;
  description_fa: string | null;
  category_id: string | null;
  order: number;
  created_at: string;
  updated_at: string;
  // Support page content. Optional: absent until the project_support migration has run.
  support_enabled?: boolean;
  support_title_en?: string | null;
  support_title_fa?: string | null;
  support_intro_en?: string | null;
  support_intro_fa?: string | null;
  support_body_en?: string | null;
  support_body_fa?: string | null;
  support_closing_en?: string | null;
  support_closing_fa?: string | null;
  support_episodes_done?: number | null;
  support_episodes_total?: number | null;
}

export interface HeroSlide {
  id: string;
  title_en: string | null;
  title_fa: string | null;
  subtitle_en: string | null;
  subtitle_fa: string | null;
  image_url: string | null;
  youtube_url: string | null;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  slug: string;
  name_en: string;
  name_fa: string;
  order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

// Serialized (camelCase) shapes returned by serializers, used by components and client code

export interface SerializedProject {
  id: string;
  slug: string;
  youtubeUrl: string | null;
  imageUrl: string | null;
  mediaType: string;
  galleryUrls: string[];
  published: boolean;
  titleEn: string;
  titleFa: string;
  descriptionEn: string | null;
  descriptionFa: string | null;
  categoryId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
  supportEnabled: boolean;
  supportTitleEn: string | null;
  supportTitleFa: string | null;
  supportIntroEn: string | null;
  supportIntroFa: string | null;
  supportBodyEn: string | null;
  supportBodyFa: string | null;
  supportClosingEn: string | null;
  supportClosingFa: string | null;
  supportEpisodesDone: number | null;
  supportEpisodesTotal: number | null;
}

export interface SerializedHeroSlide {
  id: string;
  titleEn: string | null;
  titleFa: string | null;
  subtitleEn: string | null;
  subtitleFa: string | null;
  imageUrl: string | null;
  youtubeUrl: string | null;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SerializedCategory {
  id: string;
  slug: string;
  nameEn: string;
  nameFa: string;
  order: number;
  visible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  email_sent: boolean;
  email_error: string | null;
  read: boolean;
  created_at: string;
}

export interface SerializedContactSubmission {
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  emailSent: boolean;
  emailError: string | null;
  read: boolean;
  createdAt: Date;
}
