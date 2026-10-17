import { redirect } from "next/navigation";

// Signed-out visitors are sent to /sign-in by the proxy before reaching here.
export default function Home() {
  redirect("/generators");
}
