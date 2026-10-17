import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getAuth } from "./auth";

export type Technician = { id: string; name: string; email: string };

/** The signed-in technician for this request, verified against the database. */
export const getCurrentTechnician = cache(async (): Promise<Technician | null> => {
  // Read the request first: during prerendering this suspends before any
  // configuration (secrets, database) is touched.
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email };
});

/**
 * Use at the top of every protected page and Server Action. The technician id
 * returned here is the only id the data-access layer should be given.
 */
export async function requireTechnician(): Promise<Technician> {
  const technician = await getCurrentTechnician();
  if (!technician) redirect("/sign-in");
  return technician;
}
