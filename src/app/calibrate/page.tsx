import { CalibrateClient } from "./CalibrateClient";

interface Props {
  searchParams: Promise<{ next?: string; mode?: string }>;
}

export default async function CalibratePage({ searchParams }: Props) {
  const params = await searchParams;
  let nextRoute = "/play";
  if (params.next === "/race") {
    nextRoute = params.mode === "ranked" ? "/race?mode=ranked" : "/race";
  }
  return <CalibrateClient nextRoute={nextRoute} />;
}
