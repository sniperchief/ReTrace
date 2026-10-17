import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/customer-form";
import { PageHeader } from "@/components/ui";
import { getMessages } from "@/i18n";
import { updateCustomerAction } from "@/server/actions/customers";
import { getCustomer } from "@/server/data/customers";
import { requireTechnician } from "@/server/session";

export default async function EditCustomerPage({ params }: PageProps<"/customers/[id]/edit">) {
  const technician = await requireTechnician();
  const { id } = await params;
  const customer = await getCustomer(technician.id, id);
  if (!customer) notFound();
  const t = getMessages();

  return (
    <>
      <PageHeader title={t.customers.editTitle} back={{ href: `/customers/${id}`, label: customer.name }} />
      <CustomerForm
        action={updateCustomerAction.bind(null, id)}
        initial={{
          name: customer.name,
          phone: customer.phone ?? "",
          location: customer.location ?? "",
          notes: customer.notes ?? "",
        }}
        cancelHref={`/customers/${id}`}
      />
    </>
  );
}
