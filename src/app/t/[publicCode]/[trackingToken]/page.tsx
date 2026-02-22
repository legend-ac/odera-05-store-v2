import { redirect } from "next/navigation";

export default function ShortTrackPage({
  params,
}: {
  params: { publicCode: string; trackingToken: string };
}) {
  const publicCode = decodeURIComponent(params.publicCode);
  const trackingToken = decodeURIComponent(params.trackingToken);

  redirect(`/track?publicCode=${encodeURIComponent(publicCode)}&trackingToken=${encodeURIComponent(trackingToken)}`);
}

