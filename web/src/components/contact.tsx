import { telHref, whatsappHref } from "@/lib/phone";
import { getT } from "@/server/i18n";
import { ChatIcon, PhoneIcon } from "./icons";
import { buttonStyles } from "./ui";

/** Call and WhatsApp buttons for a customer's stored phone number. */
export async function ContactButtons({ phone, message }: { phone: string; message?: string }) {
  const t = await getT();
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <a href={telHref(phone)} className={`${buttonStyles.secondary} min-h-10 px-4`}>
        <PhoneIcon size={16} /> {t.contact.call}
      </a>
      <a href={whatsappHref(phone, message)} target="_blank" rel="noopener noreferrer"
        className={`${buttonStyles.secondary} min-h-10 px-4`}>
        <ChatIcon size={16} /> {t.contact.whatsapp}
      </a>
    </div>
  );
}
