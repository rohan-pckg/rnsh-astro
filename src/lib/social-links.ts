export const contactLinks = {
  email: {
    label: "email me",
    href: "mailto:rnsh.space@gmail.com",
  },
  github: {
    label: "GitHub",
    href: "https://github.com/rohan-pckg",
  },
} as const

export const socialLinks = {
  github: {
    label: "GitHub",
    href: contactLinks.github.href,
  },
  x: {
    label: "X",
    href: "https://x.com/rohan_pckg",
  },
  linkedin: {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/rohan-pckg",
  },
  medium: {
    label: "Medium",
    href: "https://medium.com/@rohan-pckg",
  },
  cosmos: {
    label: "Cosmos",
    href: "https://www.cosmos.so/rohan-pckg",
  },
} as const

export const socialLinkList = Object.values(socialLinks)
