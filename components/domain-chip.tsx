import { domainPresentation } from "@/lib/domains";

type Props = {
  domain: string | null | undefined;
};

/**
 * Small pill displayed alongside today's task heading to show which
 * curriculum domain the prompt was sampled from. Renders nothing when the
 * task has no domain (legacy rows, pending state).
 */
export function DomainChip({ domain }: Props) {
  const presentation = domainPresentation(domain);
  if (!presentation) return null;
  const { label, Icon } = presentation;
  return (
    <span className="domain-chip" aria-label={`Domain: ${label}`}>
      <Icon size={14} strokeWidth={2.2} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
