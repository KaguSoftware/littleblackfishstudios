'use client';

import React from 'react';
import { ProjectCardProps } from './types';
import { twMerge } from 'tailwind-merge';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getYouTubeMaxResThumbnail } from '@/lib/youtube';

const MotionLink = motion.create(Link);

const LIFT_SPRING = { type: 'spring' as const, stiffness: 300, damping: 20 };

const ProjectCard: React.FC<ProjectCardProps> = ({ project, locale }) => {
  const isRtl = locale === 'fa';
  const youtubeThumbnailUrl = getYouTubeMaxResThumbnail(project.youtubeUrl);
  const displayImageUrl = youtubeThumbnailUrl || project.imageUrl;

  return (
    <MotionLink
      href={`/${locale}/projects/${project.slug}`}
      whileHover="hover"
      initial="rest"
      animate="rest"
      className={twMerge(
        "group block overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-950 transition-colors duration-300 hover:border-blue-500/40 hover:shadow-xl hover:shadow-blue-500/10",
        isRtl ? "text-right" : "text-left"
      )}
      variants={{
        rest: { y: 0 },
        hover: { y: -4, transition: LIFT_SPRING },
      }}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
        {displayImageUrl ? (
          <motion.div
            className="absolute inset-0"
            variants={{
              rest: { scale: 1 },
              hover: { scale: 1.05, transition: { duration: 0.5, ease: 'easeOut' } },
            }}
          >
            <Image
              src={displayImageUrl}
              alt={isRtl ? project.titleFa : project.titleEn}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover"
            />
          </motion.div>
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            {isRtl ? 'پیش‌نمایش' : 'No preview'}
          </div>
        )}
        {/* Arrow overlay, visible at rest on touch, emphasised on hover */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          variants={{
            rest: { backgroundColor: 'rgba(0,0,0,0)' },
            hover: { backgroundColor: 'rgba(0,0,0,0.30)', transition: { duration: 0.3 } },
          }}
        >
          <motion.div
            className="flex size-12 items-center justify-center rounded-full bg-white/5 text-white/40 shadow-lg"
            variants={{
              rest: { scale: 0.9, backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' },
              hover: {
                scale: 1,
                backgroundColor: 'rgba(255,255,255,0.10)',
                color: 'rgba(255,255,255,0.8)',
                transition: { duration: 0.3, ease: 'easeOut' },
              },
            }}
          >
            <ArrowUpRight size={22} />
          </motion.div>
        </motion.div>
      </div>
      <div className="p-5">
        <h3 className="relative w-fit text-xl font-bold text-zinc-50 transition-colors group-hover:text-blue-400">
          {isRtl ? project.titleFa : project.titleEn}
          <span
            className={`absolute -bottom-px h-px w-0 bg-blue-500 transition-all duration-300 group-hover:w-full ${
              isRtl ? 'right-0' : 'left-0'
            }`}
          />
        </h3>
        <p className="mt-2 text-sm text-zinc-500 line-clamp-2">
          {isRtl ? project.descriptionFa : project.descriptionEn}
        </p>
      </div>
    </MotionLink>
  );
};

export default ProjectCard;
