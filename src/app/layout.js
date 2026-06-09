import { DM_Sans } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "yiff.feed — furry community",
  description: "Shorts, posts, and connections for the furry community",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} font-sans min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
