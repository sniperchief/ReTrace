import type { SVGProps } from "react";

// Thin outlined monochrome icons (currentColor), per the design system.
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" {...props}>
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></Icon>
);
export const GeneratorIcon = (p: IconProps) => (
  <Icon {...p}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="m13 9-3 4h4l-3 4" /><path d="M7 6V4m10 2V4" /></Icon>
);
export const PeopleIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5" /></Icon>
);
export const HistoryIcon = (p: IconProps) => (
  <Icon {...p}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></Icon>
);
export const PlusIcon = (p: IconProps) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const MicIcon = (p: IconProps) => (
  <Icon {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></Icon>
);
export const FormIcon = (p: IconProps) => (
  <Icon {...p}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>
);
export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}><path d="m9 6 6 6-6 6" /></Icon>
);
export const ArrowLeftIcon = (p: IconProps) => (
  <Icon {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Icon>
);
export const CheckIcon = (p: IconProps) => (
  <Icon {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
);
export const StopIcon = (p: IconProps) => (
  <Icon {...p}><rect x="6" y="6" width="12" height="12" rx="1.5" /></Icon>
);
export const PhoneIcon = (p: IconProps) => (
  <Icon {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></Icon>
);
export const ChatIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20" /><path d="M9 10h6M9 13h4" /></Icon>
);
export const TrashIcon = (p: IconProps) => (
  <Icon {...p}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></Icon>
);
export const ReceiptIcon = (p: IconProps) => (
  <Icon {...p}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></Icon>
);
export const WrenchIcon = (p: IconProps) => (
  <Icon {...p}><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 1-2-2z" /><path d="M14.5 6.5 17 4l3 3-2.5 2.5" /></Icon>
);
export const CloudOffIcon = (p: IconProps) => (
  <Icon {...p}><path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.3 9 4.5 4.5 0 0 0 7 18" /><path d="m3 3 18 18" /></Icon>
);
