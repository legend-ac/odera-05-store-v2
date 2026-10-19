import StorefrontMotion from "@/components/StorefrontMotion";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<StorefrontMotion /></>;
}
