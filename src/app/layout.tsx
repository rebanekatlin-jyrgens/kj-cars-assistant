import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "KJ Cars Assistant",
  description: "Submit your car sale enquiry to KJ Cars with a guided assistant.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Shrinks the layout when the on-screen keyboard opens, so the message box stays visible.
  interactiveWidget: "resizes-content",
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        {/* Offset keeps toasts below the 64px top bar so they never cover the menu button. */}
        <Toaster position="top-center" richColors closeButton offset={{ top: 72 }} mobileOffset={{ top: 72 }} />
      </body>
    </html>
  );
}
