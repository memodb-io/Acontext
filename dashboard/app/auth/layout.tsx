"use client";

import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { ThemeToggle } from "@/components/theme-toggle";
import Autoplay from "embla-carousel-autoplay";

export default function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex gap-2 justify-start">
          <Link href="/" className="flex items-center gap-2">
            {/* Light mode logo */}
            <Image
              src="https://assets.memodb.io/Acontext/Acontext-oneway.gif"
              alt="logo"
              width={142}
              height={32}
              unoptimized
              className="rounded-sm object-cover dark:hidden"
            />
            {/* Dark mode logo */}
            <Image
              src="https://assets.memodb.io/Acontext/Acontext-oneway-dark.gif"
              alt="logo"
              width={142}
              height={32}
              unoptimized
              className="rounded-sm object-cover hidden dark:block"
            />
          </Link>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs"><Suspense>{children}</Suspense></div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <ImageCarousel
          delay={5000}
          aspectRatio="aspect-[3/4]"
          images={[
            "https://assets.memodb.io/Acontext/dashboard/BI.png",
            "https://assets.memodb.io/Acontext/dashboard/artifact_viewer.png",
            "https://assets.memodb.io/Acontext/dashboard/message_viewer.png",
            "https://assets.memodb.io/Acontext/dashboard/session_task_viewer.png",
            "https://assets.memodb.io/Acontext/dashboard/skill_viewer.png",
            "https://assets.memodb.io/Acontext/dashboard/task_viewer.png",
            "https://assets.memodb.io/Acontext/dashboard/traces_viewer.png",
          ]}
        />
      </div>
    </div>
  );
}

interface ImageCarouselProps {
  images: string[];
  aspectRatio?: string; // 默认 16:9
  objectFit?: "cover" | "contain";
  delay?: number;
}

export const ImageCarousel = ({
  images,
  aspectRatio = "aspect-[16/9]",
  objectFit = "cover",
  delay = 2000,
}: ImageCarouselProps) => {
  return (
    <Carousel
      className="w-full"
      plugins={[
        Autoplay({
          delay: delay,
        }),
      ]}
    >
      <CarouselContent>
        {images.map((src, index) => (
          <CarouselItem key={index}>
            <div className={`w-full h-dvh ${aspectRatio} relative`}>
              <Image
                src={src}
                alt={`Image ${index + 1}`}
                fill
                unoptimized
                className={`object-${objectFit} object-top-left`}
              />
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  );
};
