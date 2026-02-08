
import { Analytics } from "@vercel/analytics/react"
import { SpeedInsights } from "@vercel/speed-insights/next"

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Sidebar from "@/components/navigation/Sidebar";
import BugReportButton from "@/components/BugReportButton";
import { createClient } from '@/lib/supabase/server'
import { ProjectProvider } from "@/context/ProjectContext";
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@prisma/client';

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Task Data | Ingestion & Similarity Analysis",
  description: "A professional tool for ingesting CSV and API data, filtering it, and analyzing similarity using local LLMs.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let role: UserRole = 'USER'
  if (user) {
    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { role: true }
    })

    role = profile?.role || 'USER'
  }

  return (
    <html lang="en">
      <body className={inter.className}>
        <ProjectProvider>
          <div className="app-container">
            {user && <Sidebar userRole={role} />}
            <div className="main-content">
              <Header />
              <main className="content-area">
                {children}
              </main>
            </div>
          </div>
        </ProjectProvider>
        {user && <BugReportButton />}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
