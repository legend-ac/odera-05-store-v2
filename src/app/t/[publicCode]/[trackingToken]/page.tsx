import { redirect } from "next/navigation";

export default async function ShortTrackPage({
  params,
}: {
  params: Promise<{ publicCode: string; trackingToken: string }>;
}) {
  const routeParams = await params;
  const publicCode = decodeURIComponent(routeParams.publicCode);
  const trackingToken = decodeURIComponent(routeParams.trackingToken);

  redirect(`/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`);
}

