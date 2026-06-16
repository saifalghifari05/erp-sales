import { redirect } from "next/navigation";
import { getSessionProfile } from "@/server/auth";

export default async function Home() {
  const me = await getSessionProfile();
  redirect(me ? "/board" : "/login");
}
