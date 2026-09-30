import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finverse CRM",
  description: "Premium financial customer relationship management",
  applicationName: "Finverse CRM",
  referrer: "origin-when-cross-origin",
  creator: "Finverse",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
