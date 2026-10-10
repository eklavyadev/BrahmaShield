import { IncidentsPage } from "@/components/incidents";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ review?: string }>;
}) {
  const params = await searchParams;
  return <IncidentsPage initialReview={params.review === "1"} />;
}
