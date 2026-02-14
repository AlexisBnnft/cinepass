import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CinePass - Cinémas Paris",
  description: "Tous les films à l'affiche dans vos cinémas parisiens",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className={`${geist.variable} font-sans antialiased bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-white`}>
        {children}
      </body>
    </html>
  );
}
