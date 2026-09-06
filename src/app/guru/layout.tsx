import LmsLayout from '@/components/LmsLayout';

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  return (
    <LmsLayout role="guru" userName="Guru" pageTitle="Portal Guru">
      {children}
    </LmsLayout>
  );
}
