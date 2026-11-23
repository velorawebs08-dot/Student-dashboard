export const siteData = {
  tuitionName: "Patil Classes",
  shortName: "PatilMarks",
  tagline: "Track every mark, together.",
  logo: "https://i.postimg.cc/pVqdMhkw/image.png",
  logoFallbackInitials: "PC",
  standard: "10th",
  subjects: [
    "Maths",
    "Science",
    "English",
    "Marathi",
    "Hindi",
    "Social Science",
  ] as const,
  brandColors: {
    primary: "#0F2A4A",
    primaryDark: "#091B30",
    accent: "#F5A623",
    background: "#F7F8FA",
  },
  sessionDays: 60,
  otpExpiryMinutes: 10,
  otpResendSeconds: 30,
  otpMaxAttempts: 5,
  otpLockMinutes: 15,
} as const;

export type Subject = (typeof siteData.subjects)[number];
