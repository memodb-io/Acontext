import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookIcon, Github, HomeIcon } from "lucide-react";
import { DiscordIcon } from "@/components/icons";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <img
            src="/logo/light.svg"
            alt="Acontext"
            className="block h-6 dark:hidden"
          />
          <img
            src="/logo/dark.svg"
            alt="Acontext"
            className="hidden h-6 dark:block"
          />
        </>
      ),
    },
    githubUrl: "https://github.com/memodb-io/Acontext",
    links: [
      {
        text: "Home",
        url: "https://acontext.io",
        icon: <HomeIcon />,
      },
      {
        text: "Readme",
        url: "https://github.com/memodb-io/Acontext",
        icon: <Github />,
      },
      {
        text: "Discord",
        url: "https://discord.acontext.io",
        icon: <DiscordIcon />,
      },
      {
        text: "Blog",
        url: "https://blog.acontext.io",
        icon: <BookIcon />,
      },
    ],
  };
}
