import { redirect } from "next/navigation";
import { verifyAuth } from "@/lib/auth";

export default async function Home() {
  const user = await verifyAuth();
  if (user) {
    redirect("/dashboard/agents");
  } else {
    redirect("/login");
  }
}
