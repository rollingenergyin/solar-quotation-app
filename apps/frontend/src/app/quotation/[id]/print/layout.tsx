import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    absolute: 'Proposal',
  },
};

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
