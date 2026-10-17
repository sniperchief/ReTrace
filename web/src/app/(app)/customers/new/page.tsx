import type { Metadata } from "next";
import { CustomerForm } from "@/components/customer-form";
import { PageHeader } from "@/components/ui";
import { createCustomerAction } from "@/server/actions/customers";
import { getT } from "@/server/i18n";
import { requireTechnician } from "@/server/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT()).customers.new };
}

export default async function NewCustomerPage() {
  await requireTechnician();
  const t = await getT();
  return (
    <>
      <PageHeader title={t.customers.new} back={{ href: "/customers", label: t.customers.title }} />
      <CustomerForm
        action={createCustomerAction}
        initial={{ name: "", phone: "", location: "", notes: "" }}
        cancelHref="/customers"
      />
    </>
  );
}
